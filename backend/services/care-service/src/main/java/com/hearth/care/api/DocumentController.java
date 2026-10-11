package com.hearth.care.api;

import com.hearth.care.dto.CareDtos.AccessRequest;
import com.hearth.care.dto.CareDtos.DocumentView;
import com.hearth.care.application.DocumentService;
import com.hearth.care.application.DocumentService.Download;
import jakarta.validation.Valid;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.UUID;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final DocumentService documents;

    public DocumentController(DocumentService documents) {
        this.documents = documents;
    }

    @GetMapping
    public List<DocumentView> list() {
        return documents.list();
    }

    /** multipart/form-data: the file plus title, category, optional ownerId (who it is about), access and (repeated) allowedIds. */
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public DocumentView upload(
            @RequestPart("file") MultipartFile file,
            @RequestParam(required = false) String title,
            @RequestParam String category,
            @RequestParam(required = false) UUID ownerId,
            @RequestParam String access,
            @RequestParam(required = false) List<UUID> allowedIds,
            @RequestParam(required = false) UUID appointmentId) {
        return documents.upload(file, title, category, ownerId, access, allowedIds, appointmentId);
    }

    @PutMapping("/{id}/access")
    public DocumentView updateAccess(@PathVariable UUID id, @Valid @RequestBody AccessRequest request) {
        return documents.updateAccess(id, request.access(), request.allowedIds());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove(@PathVariable UUID id) {
        documents.remove(id);
    }

    @GetMapping("/{id}/file")
    public ResponseEntity<Resource> download(@PathVariable UUID id) {
        Download download = documents.download(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(download.document().getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(download.document().getFileName(), StandardCharsets.UTF_8).build().toString())
                .body(download.file());
    }
}
