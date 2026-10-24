package com.hearth.care.application;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.hearth.care.catalogue.Catalogue;
import com.hearth.care.domain.HealthProfile;
import com.hearth.care.dto.CareDtos.ConditionOption;
import com.hearth.care.dto.CareDtos.FoodOption;
import com.hearth.care.dto.CareDtos.FoodSuggestion;
import com.hearth.care.dto.CareDtos.HealthProfileInput;
import com.hearth.care.dto.CareDtos.HealthProfileView;
import com.hearth.care.infrastructure.repository.GroceryItemRepository;
import com.hearth.care.infrastructure.repository.HealthProfileRepository;
import com.hearth.common.events.EventPublisher;
import com.hearth.common.family.Availability;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.MemberRef;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class HealthServiceTest {

    private FamilyDirectory directory;
    private HealthProfileRepository profiles;
    private GroceryItemRepository groceries;
    private Catalogue catalogue;
    private EventPublisher events;
    private HealthService service;

    private final UUID familyId = UUID.randomUUID();
    private final UUID memberId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        directory = mock(FamilyDirectory.class);
        profiles = mock(HealthProfileRepository.class);
        groceries = mock(GroceryItemRepository.class);
        catalogue = mock(Catalogue.class);
        events = mock(EventPublisher.class);

        service = new HealthService(directory, profiles, groceries, catalogue, events);

        FamilyContext context = new FamilyContext(
                UUID.randomUUID(), memberId, "Test Member", familyId, "lead", true, true, true, "UTC");
        when(directory.context()).thenReturn(context);

        MemberRef ref = new MemberRef(memberId, "Test Member", "lead", "active", List.of(), Availability.weekdays());
        when(directory.members()).thenReturn(List.of(ref));
        when(directory.dependants()).thenReturn(List.of());
    }

    @Test
    @DisplayName("get() returns the health profile of the calling member")
    void getOwnHealthProfile() {
        HealthProfile profile = new HealthProfile(familyId, memberId);
        profile.setConditions(List.of("diabetes"));
        profile.setNotes("Monitor blood sugar");
        when(profiles.findByFamilyIdAndPersonId(familyId, memberId)).thenReturn(Optional.of(profile));

        HealthProfileView view = service.get(memberId);

        assertThat(view).isNotNull();
        assertThat(view.personId()).isEqualTo(memberId);
        assertThat(view.conditions()).containsExactly("diabetes");
        assertThat(view.notes()).isEqualTo("Monitor blood sugar");
    }

    @Test
    @DisplayName("save() stores updated profile and publishes domain event")
    void saveHealthProfile() {
        when(profiles.findByFamilyIdAndPersonId(familyId, memberId)).thenReturn(Optional.empty());
        when(profiles.save(any(HealthProfile.class))).thenAnswer(i -> i.getArgument(0));
        when(catalogue.condition("hypertension")).thenReturn(Optional.of(new ConditionOption("hypertension", "Hypertension", "High BP", List.of("low-sodium"))));

        HealthProfileInput input = new HealthProfileInput(
                List.of("hypertension"),
                List.of(),
                List.of("nuts"),
                List.of("fish"),
                "Low sodium diet recommended",
                true
        );

        HealthProfileView view = service.save(memberId, input);

        assertThat(view).isNotNull();
        assertThat(view.conditions()).containsExactly("hypertension");
        assertThat(view.avoid()).containsExactly("nuts");
        verify(profiles).save(any(HealthProfile.class));
        verify(events).publish(any(), any());
    }

    @Test
    @DisplayName("suggest() matches conditions to foods with corresponding tags")
    void suggestFoodsMatchesConditionTags() {
        HealthProfile profile = new HealthProfile(familyId, memberId);
        profile.setConditions(List.of("anemia"));

        ConditionOption condition = new ConditionOption("anemia", "Anemia", "Iron deficiency", List.of("iron-rich"));
        FoodOption spinach = new FoodOption(
                "spinach", "Spinach", "Palak", "Vegetables",
                List.of("iron-rich", "fiber"), "Fresh leafy green", "1 bunch",
                25.0, List.of()
        );

        when(catalogue.condition("anemia")).thenReturn(Optional.of(condition));
        when(catalogue.foods()).thenReturn(List.of(spinach));

        List<FoodSuggestion> suggestions = HealthService.suggest(List.of(profile), catalogue, Set.of());

        assertThat(suggestions).hasSize(1);
        assertThat(suggestions.get(0).id()).isEqualTo("spinach");
        assertThat(suggestions.get(0).reasons()).hasSize(1);
        assertThat(suggestions.get(0).reasons().get(0).tags()).containsExactly("iron-rich");
    }

    @Test
    @DisplayName("suggest() filters out foods present in the avoid list")
    void suggestFoodsFiltersAvoidedAllergens() {
        HealthProfile profile = new HealthProfile(familyId, memberId);
        profile.setConditions(List.of("anemia"));
        profile.setAvoid(List.of("spinach"));

        ConditionOption condition = new ConditionOption("anemia", "Anemia", "Iron deficiency", List.of("iron-rich"));
        FoodOption spinach = new FoodOption(
                "spinach", "Spinach", "Palak", "Vegetables",
                List.of("iron-rich"), "Leafy green", "1 bunch",
                25.0, List.of()
        );

        when(catalogue.condition("anemia")).thenReturn(Optional.of(condition));
        when(catalogue.foods()).thenReturn(List.of(spinach));

        List<FoodSuggestion> suggestions = HealthService.suggest(List.of(profile), catalogue, Set.of());

        assertThat(suggestions).isEmpty();
    }
}
