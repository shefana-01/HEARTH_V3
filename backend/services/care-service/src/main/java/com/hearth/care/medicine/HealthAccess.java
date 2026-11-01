package com.hearth.care.medicine;

import com.hearth.care.domain.HealthProfile;
import com.hearth.care.infrastructure.repository.HealthProfileRepository;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import com.hearth.common.family.People;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Who may see and change someone's medicines and emergency details: the same rules as their health notes.
 * Your own always. Someone else's with medical access (the organiser always has it): a dependant's always, a
 * member's only if they share their health notes. Changing them: your own, or a dependant's with medical
 * access unless you are an observer. The carer of a medicine also sees and records that medicine.
 */
@Component
public class HealthAccess {

    private final FamilyDirectory directory;
    private final HealthProfileRepository profiles;

    public HealthAccess(FamilyDirectory directory, HealthProfileRepository profiles) {
        this.directory = directory;
        this.profiles = profiles;
    }

    public boolean canSee(FamilyContext context, UUID personId) {
        if (personId.equals(context.memberId())) {
            return true;
        }
        if (!context.canSeeMedical()) {
            return false;
        }
        if (People.isDependant(directory, personId)) {
            return true;
        }
        return profiles.findByFamilyIdAndPersonId(context.familyId(), personId).map(HealthProfile::isShared).orElse(false);
    }

    public boolean canEdit(FamilyContext context, UUID personId) {
        if (personId.equals(context.memberId())) {
            return true;
        }
        return People.isDependant(directory, personId) && context.canSeeMedical() && !context.isObserver();
    }
}
