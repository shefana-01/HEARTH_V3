package com.hearth.care.application;

import com.hearth.care.domain.CareDocument;
import com.hearth.care.dto.CareDtos.DocumentView;
import com.hearth.care.infrastructure.repository.AppointmentRepository;
import com.hearth.care.infrastructure.repository.CareDocumentRepository;
import com.hearth.care.infrastructure.storage.FileStorage;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.People;
import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Reports, prescriptions, insurance papers and anything else worth keeping.
 *
 * A document is either open to the family (members with document access) or restricted to named people.
 * The person who uploaded it and the person it is about can always open it. One the caller may not see is
 * "not found", and only family documents are written to the activity log: the title of a restricted one is
 * not for everyone.
 */
@Service
public class DocumentService {

    private static final long MAX_BYTES = 20L * 1024 * 1024;
    private static final Set<String> CATEGORIES = Set.of("Medical report", "Prescription", "Lab result", "Insurance", "ID & legal", "School & work", "Bills & receipts", "Other");
    private static final Set<String> ACCEPTED_TYPES = Set.of(
            "application/pdf", "image/png", "image/jpeg", "image/heic", "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    public record Download(CareDocument document, Resource file) {
    }

    private final FamilyDirectory directory;
    private final CareDocumentRepository documents;
    private final AppointmentRepository appointments;
    private final FileStorage storage;
    private final EventPublisher events;

    public DocumentService(FamilyDirectory directory, CareDocumentRepository documents, AppointmentRepository appointments, FileStorage storage, EventPublisher events) {
        this.directory = directory;
        this.documents = documents;
        this.appointments = appointments;
        this.storage = storage;
        this.events = events;
    }

    /** Documents the caller is allowed to see. */
    @Transactional(readOnly = true)
    public List<DocumentView> list() {
        FamilyContext context = directory.context();
        return documents.findByFamilyIdOrderByUploadedAtDesc(context.familyId()).stream().filter(document -> visible(document, context)).map(DocumentService::view).toList();
    }

    @Transactional
    public DocumentView upload(MultipartFile file, String title, String category, UUID ownerId, String access, List<UUID> allowedIds, UUID appointmentId) {
        FamilyContext context = directory.context();
        context.requireContributor();
        if (file == null || file.isEmpty()) {
            throw ApiException.badRequest("Choose a file to upload.");
        }
        if (file.getSize() > MAX_BYTES) {
            throw new ApiException(HttpStatus.PAYLOAD_TOO_LARGE, "Files must be 20 MB or smaller.");
        }
        if (file.getContentType() == null || !ACCEPTED_TYPES.contains(file.getContentType())) {
            throw new ApiException(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "Upload a PDF, an image or a Word document.");
        }
        if (!CATEGORIES.contains(category)) {
            throw ApiException.badRequest("Choose a category.");
        }
        requireAccessValue(access);
        if (ownerId != null && !People.exists(directory, ownerId)) {
            throw ApiException.unprocessable("Choose who this document is about.");
        }
        if (appointmentId != null) {
            // Only a visit the caller can see may be linked, so a private visit is never confirmed to exist.
            appointments.findByIdAndFamilyId(appointmentId, context.familyId()).filter(appointment -> AppointmentService.canSee(appointment, context)).orElseThrow(() -> ApiException.notFound("That appointment"));
        }
        List<String> allowed = allowed(access, context.memberId(), allowedIds);

        String fileName = safeName(file.getOriginalFilename());
        CareDocument document = new CareDocument();
        document.setId(UUID.randomUUID());
        document.setFamilyId(context.familyId());
        String shownTitle = title == null || title.isBlank() ? fileName : title.trim();
        document.setTitle(shownTitle.length() > 160 ? shownTitle.substring(0, 160) : shownTitle);
        document.setCategory(category);
        document.setFileName(fileName);
        document.setContentType(file.getContentType());
        document.setSizeKb((int) Math.max(1, Math.round(file.getSize() / 1024.0)));
        document.setStorageKey(context.familyId() + "/" + document.getId());
        document.setUploadedAt(Instant.now());
        document.setUploadedById(context.memberId());
        document.setOwnerId(ownerId);
        document.setAccess(access);
        document.setAllowedIds(allowed);
        document.setAppointmentId(appointmentId);

        try (InputStream in = file.getInputStream()) {
            storage.store(document.getStorageKey(), in);
        } catch (IOException ex) {
            throw new ApiException(HttpStatus.INTERNAL_SERVER_ERROR, "The file could not be saved. Please try again.");
        }
        documents.save(document);

        Events event = Events.of("document.uploaded", context).data("documentId", document.getId());
        if (CareDocument.FAMILY.equals(access)) {
            event.audit("care", "Added a document", document.getTitle());
        }
        events.publish(Topics.CARE, event.build());
        return view(document);
    }

    @Transactional
    public DocumentView updateAccess(UUID id, String access, List<UUID> allowedIds) {
        FamilyContext context = directory.context();
        CareDocument document = find(context, id);
        requireManager(document, context);
        requireAccessValue(access);
        List<String> allowed = allowed(access, context.memberId(), allowedIds);
        boolean newlyShared = CareDocument.FAMILY.equals(access) && !CareDocument.FAMILY.equals(document.getAccess());
        document.setAccess(access);
        document.setAllowedIds(allowed);
        documents.save(document);

        Events event = Events.of("document.access-changed", context).data("documentId", document.getId());
        // Its title becomes known to the family only now.
        if (newlyShared) {
            event.audit("care", "Shared a document with the family", document.getTitle());
        }
        events.publish(Topics.CARE, event.build());
        return view(document);
    }

    @Transactional
    public void remove(UUID id) {
        FamilyContext context = directory.context();
        CareDocument document = find(context, id);
        requireManager(document, context);
        documents.delete(document);
        storage.delete(document.getStorageKey());

        Events event = Events.of("document.deleted", context).data("documentId", document.getId());
        if (CareDocument.FAMILY.equals(document.getAccess())) {
            event.audit("care", "Deleted a document", document.getTitle());
        }
        events.publish(Topics.CARE, event.build());
    }

    @Transactional(readOnly = true)
    public Download download(UUID id) {
        FamilyContext context = directory.context();
        CareDocument document = find(context, id);
        Resource file = storage.load(document.getStorageKey());
        if (!file.exists()) {
            throw ApiException.notFound("That file");
        }
        return new Download(document, file);
    }

    private CareDocument find(FamilyContext context, UUID id) {
        // A restricted document the caller may not see is reported as "not found", not "forbidden",
        // so its existence is not revealed.
        return documents.findByIdAndFamilyId(id, context.familyId()).filter(document -> visible(document, context)).orElseThrow(() -> ApiException.notFound("That document"));
    }

    /** Your own uploads and papers about you always; a restricted one only when you are named; a family one with document access. */
    private static boolean visible(CareDocument document, FamilyContext context) {
        UUID me = context.memberId();
        if (document.getUploadedById().equals(me) || me.equals(document.getOwnerId())) {
            return true;
        }
        if (CareDocument.RESTRICTED.equals(document.getAccess())) {
            return document.getAllowedIds().contains(me.toString());
        }
        return context.canSeeDocuments();
    }

    /** Changing who may open a document, or deleting it, is for whoever uploaded it, the person it is about and the organiser. */
    private static void requireManager(CareDocument document, FamilyContext context) {
        boolean manager = document.getUploadedById().equals(context.memberId()) || context.memberId().equals(document.getOwnerId()) || context.isLead();
        if (!manager) {
            throw ApiException.forbidden("Only the person who uploaded this document, the person it is about or the organiser can change it.");
        }
    }

    private static void requireAccessValue(String access) {
        if (!CareDocument.FAMILY.equals(access) && !CareDocument.RESTRICTED.equals(access)) {
            throw ApiException.badRequest("Choose who can see this document.");
        }
    }

    /** For a restricted document: the person setting it plus the chosen members. Empty for a family one. */
    private List<String> allowed(String access, UUID me, List<UUID> chosen) {
        if (!CareDocument.RESTRICTED.equals(access)) {
            return new ArrayList<>();
        }
        Set<String> ids = new LinkedHashSet<>();
        ids.add(me.toString());
        for (UUID id : chosen == null ? List.<UUID>of() : chosen) {
            if (!People.isMember(directory, id)) {
                throw ApiException.unprocessable("Choose people from your family.");
            }
            ids.add(id.toString());
        }
        return new ArrayList<>(ids);
    }

    /** Someone left the family or is no longer looked after: documents about them become household documents. Called by the event listener. */
    @Transactional
    public void personLeft(UUID familyId, UUID personId) {
        List<CareDocument> about = documents.findByFamilyIdAndOwnerId(familyId, personId);
        for (CareDocument document : about) {
            document.setOwnerId(null);
        }
        documents.saveAll(about);
    }

    /** Keeps only the file name itself, so a path sent by the browser can never be used. */
    private static String safeName(String original) {
        if (original == null || original.isBlank()) {
            return "document";
        }
        String name = original.replace('\\', '/');
        name = name.substring(name.lastIndexOf('/') + 1).trim();
        if (name.isEmpty()) {
            return "document";
        }
        return name.length() > 255 ? name.substring(name.length() - 255) : name;
    }

    private static DocumentView view(CareDocument document) {
        return new DocumentView(
                document.getId(), document.getTitle(), document.getCategory(), document.getFileName(), document.getSizeKb(), document.getUploadedAt(), document.getUploadedById(),
                document.getOwnerId(), document.getAccess(), document.getAllowedIds(), document.getAppointmentId());
    }
}
