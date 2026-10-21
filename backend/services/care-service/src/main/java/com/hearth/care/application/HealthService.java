package com.hearth.care.application;

import com.hearth.care.catalogue.Catalogue;
import com.hearth.care.domain.HealthProfile;
import com.hearth.care.domain.HealthProfile.Goal;
import com.hearth.care.dto.CareDtos.FoodOption;
import com.hearth.care.dto.CareDtos.FoodSuggestion;
import com.hearth.care.dto.CareDtos.GoalInput;
import com.hearth.care.dto.CareDtos.GoalView;
import com.hearth.care.dto.CareDtos.HealthProfileInput;
import com.hearth.care.dto.CareDtos.HealthProfileView;
import com.hearth.care.dto.CareDtos.SuggestionReason;
import com.hearth.care.infrastructure.repository.GroceryItemRepository;
import com.hearth.care.infrastructure.repository.HealthProfileRepository;
import com.hearth.common.error.ApiException;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.events.EventTypes;
import com.hearth.common.events.Events;
import com.hearth.common.events.Topics;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.People;
import com.hearth.common.text.Formats;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Health notes and the food suggestions made from them.
 *
 * Who may see whose notes: your own always. Someone else's only with "medical" access (the organiser always
 * has it), and then a dependant's always but a member's only if they chose to share it. You may change your
 * own notes, and with medical access those of people the family looks after. Hearth never diagnoses: it
 * only matches the notes people add to everyday foods.
 */
@Service
public class HealthService {

    private final FamilyDirectory directory;
    private final HealthProfileRepository profiles;
    private final GroceryItemRepository groceries;
    private final Catalogue catalogue;
    private final EventPublisher events;

    public HealthService(FamilyDirectory directory, HealthProfileRepository profiles, GroceryItemRepository groceries, Catalogue catalogue, EventPublisher events) {
        this.directory = directory;
        this.profiles = profiles;
        this.groceries = groceries;
        this.catalogue = catalogue;
        this.events = events;
    }

    /** The caller's own profile (blank if none yet), then everyone else's they may see. */
    @Transactional(readOnly = true)
    public List<HealthProfileView> list() {
        FamilyContext context = directory.context();
        List<HealthProfile> all = profiles.findByFamilyId(context.familyId());
        List<HealthProfileView> result = new ArrayList<>();
        result.add(all.stream().filter(p -> p.getPersonId().equals(context.memberId())).findFirst().map(HealthService::view).orElseGet(() -> blank(context.memberId())));
        all.stream()
                .filter(p -> !p.getPersonId().equals(context.memberId()) && canSee(context, p.getPersonId(), Optional.of(p)))
                .sorted(Comparator.comparing(HealthProfile::getUpdatedAt).reversed())
                .map(HealthService::view)
                .forEach(result::add);
        return result;
    }

    @Transactional(readOnly = true)
    public HealthProfileView get(UUID personId) {
        FamilyContext context = directory.context();
        if (!People.exists(directory, personId)) {
            throw ApiException.notFound("That person");
        }
        Optional<HealthProfile> stored = profiles.findByFamilyIdAndPersonId(context.familyId(), personId);
        if (!canSee(context, personId, stored) && !canEdit(context, personId)) {
            throw ApiException.forbidden("This person keeps their health notes private.");
        }
        return stored.map(HealthService::view).orElseGet(() -> blank(personId));
    }

    @Transactional
    public HealthProfileView save(UUID personId, HealthProfileInput input) {
        FamilyContext context = directory.context();
        if (!People.exists(directory, personId)) {
            throw ApiException.notFound("That person");
        }
        if (!canEdit(context, personId)) {
            throw ApiException.forbidden("You can only change your own health notes, or those of someone the family looks after.");
        }
        HealthProfile profile = profiles.findByFamilyIdAndPersonId(context.familyId(), personId).orElseGet(() -> new HealthProfile(context.familyId(), personId));
        profile.setConditions(cleanConditions(input.conditions()));
        profile.setGoals(cleanGoals(input.goals()));
        profile.setAvoid(cleanList(input.avoid(), 30, 60));
        profile.setPreferences(cleanList(input.preferences(), 30, 60));
        profile.setNotes(Formats.trim(input.notes()));
        profile.setShared(People.isDependant(directory, personId) || input.shared());
        profile.touch();
        profiles.save(profile);

        Events event = Events.of(EventTypes.HEALTH_UPDATED, context).data("personId", personId);
        // Only what the family is allowed to know goes in the shared activity log.
        if (profile.isShared()) {
            event.audit("care", "Updated health notes", People.name(directory, personId));
        }
        events.publish(Topics.CARE, event.build());
        return view(profile);
    }

    /**
     * Foods matching the notes of the people the caller may see (or of one of them), each with the reason.
     * Most widely useful first, then cheapest, then by name.
     */
    @Transactional(readOnly = true)
    public List<FoodSuggestion> suggestions(UUID personId) {
        FamilyContext context = directory.context();
        List<HealthProfile> visible = profiles.findByFamilyId(context.familyId()).stream()
                .filter(p -> personId == null || p.getPersonId().equals(personId))
                .filter(p -> canSee(context, p.getPersonId(), Optional.of(p)))
                .toList();
        Set<String> onList = groceries.findByFamilyIdOrderByCreatedAtAsc(context.familyId()).stream().map(g -> g.getFoodId()).filter(id -> id != null).collect(Collectors.toSet());
        return suggest(visible, catalogue, onList);
    }

    /** Pure: the same notes and foods always give the same suggestions (a line-by-line port of healthService.ts). */
    static List<FoodSuggestion> suggest(List<HealthProfile> profiles, Catalogue catalogue, Set<String> onList) {
        record Need(HealthProfile profile, String because, List<String> tags) {
        }
        List<Need> needs = new ArrayList<>();
        for (HealthProfile profile : profiles) {
            for (String id : profile.getConditions()) {
                catalogue.condition(id).ifPresent(c -> needs.add(new Need(profile, c.label(), c.tags())));
            }
            for (Goal goal : profile.getGoals()) {
                needs.add(new Need(profile, goal.title(), goal.tags()));
            }
        }
        List<FoodSuggestion> result = new ArrayList<>();
        for (FoodOption food : catalogue.foods()) {
            List<SuggestionReason> reasons = new ArrayList<>();
            for (Need need : needs) {
                if (isAvoided(food, need.profile().getAvoid())) {
                    continue;
                }
                List<String> matching = need.tags().stream().filter(food.tags()::contains).toList();
                if (!matching.isEmpty()) {
                    reasons.add(new SuggestionReason(need.profile().getPersonId(), need.because(), matching));
                }
            }
            if (!reasons.isEmpty()) {
                result.add(new FoodSuggestion(food.id(), food.name(), food.localName(), food.group(), food.tags(), food.description(), food.portion(), food.estimatedPrice(), food.alternatives(), reasons, onList.contains(food.id())));
            }
        }
        result.sort(Comparator.<FoodSuggestion>comparingInt(f -> -f.reasons().size()).thenComparingDouble(FoodSuggestion::estimatedPrice).thenComparing(FoodSuggestion::name));
        return result;
    }

    /** True when someone may be named on the shared shopping list: a dependant, or a member who shares their notes. */
    boolean shareable(UUID familyId, UUID personId) {
        return People.isDependant(directory, personId) || profiles.findByFamilyIdAndPersonId(familyId, personId).map(HealthProfile::isShared).orElse(false);
    }

    /** Someone left the family or is no longer looked after: their notes go with them. Called by the event listener. */
    @Transactional
    public void personLeft(UUID familyId, UUID personId) {
        profiles.deletePerson(familyId, personId);
    }

    private boolean canSee(FamilyContext context, UUID personId, Optional<HealthProfile> stored) {
        if (personId.equals(context.memberId())) {
            return true;
        }
        if (!context.canSeeMedical()) {
            return false;
        }
        if (People.isDependant(directory, personId)) {
            return true;
        }
        return stored.map(HealthProfile::isShared).orElse(false);
    }

    private boolean canEdit(FamilyContext context, UUID personId) {
        if (personId.equals(context.memberId())) {
            return true;
        }
        return People.isDependant(directory, personId) && context.canSeeMedical() && !context.isObserver();
    }

    private static boolean isAvoided(FoodOption food, List<String> avoid) {
        String text = (food.name() + " " + (food.localName() == null ? "" : food.localName())).toLowerCase(Locale.ROOT);
        return avoid.stream().anyMatch(a -> !a.isBlank() && text.contains(a.trim().toLowerCase(Locale.ROOT)));
    }

    private List<String> cleanConditions(List<String> input) {
        return input == null ? new ArrayList<>() : new ArrayList<>(new LinkedHashSet<>(input.stream().filter(id -> id != null && catalogue.condition(id).isPresent()).toList()));
    }

    private List<Goal> cleanGoals(List<GoalInput> input) {
        List<Goal> goals = new ArrayList<>();
        for (GoalInput goal : input == null ? List.<GoalInput>of() : input) {
            if (goal == null || goal.title() == null || goal.title().isBlank()) {
                continue;
            }
            List<String> tags = goal.tags() == null ? List.of() : goal.tags().stream().filter(catalogue::isTag).distinct().toList();
            if (tags.isEmpty()) {
                continue;
            }
            String id = goal.id() == null || goal.id().isBlank() ? UUID.randomUUID().toString() : goal.id().trim();
            goals.add(new Goal(id, goal.title().trim(), Formats.trim(goal.target()), tags));
        }
        if (goals.size() > 20) {
            throw ApiException.unprocessable("You can add up to 20 goals.");
        }
        return goals;
    }

    private static List<String> cleanList(List<String> input, int maxItems, int maxLength) {
        List<String> items = input == null ? List.of() : input.stream().filter(v -> v != null && !v.isBlank()).map(String::trim).distinct().toList();
        if (items.size() > maxItems || items.stream().anyMatch(v -> v.length() > maxLength)) {
            throw ApiException.unprocessable("Keep the list to " + maxItems + " short entries.");
        }
        return new ArrayList<>(items);
    }

    private HealthProfileView blank(UUID personId) {
        return new HealthProfileView(personId, List.of(), List.of(), List.of(), List.of(), "", People.isDependant(directory, personId), Instant.now());
    }

    static HealthProfileView view(HealthProfile profile) {
        return new HealthProfileView(
                profile.getPersonId(),
                List.copyOf(profile.getConditions()),
                profile.getGoals().stream().map(g -> new GoalView(g.id(), g.title(), g.target(), g.tags())).toList(),
                List.copyOf(profile.getAvoid()),
                List.copyOf(profile.getPreferences()),
                profile.getNotes(),
                profile.isShared(),
                profile.getUpdatedAt());
    }
}
