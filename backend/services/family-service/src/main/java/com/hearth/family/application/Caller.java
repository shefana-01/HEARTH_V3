package com.hearth.family.application;

import com.hearth.common.error.ApiException;
import com.hearth.common.family.FamilyContext;
import com.hearth.common.security.CurrentUser;
import com.hearth.family.domain.Account;
import com.hearth.family.domain.Family;
import com.hearth.family.domain.Member;
import com.hearth.family.repository.AccountRepository;
import com.hearth.family.repository.FamilyRepository;
import com.hearth.family.repository.MemberRepository;
import org.springframework.stereotype.Component;

/** Who is making the current request: their account, and their membership once they have a family. */
@Component
public class Caller {

    /** The signed-in person and their place in a family. */
    public record Membership(Account account, Member member, Family family) {

        public FamilyContext context() {
            return new FamilyContext(
                    account.getId(),
                    member.getId(),
                    member.getName(),
                    family.getId(),
                    member.getRole(),
                    member.isAccessSchedule(),
                    member.canSeeMedical(),
                    member.canSeeDocuments(),
                    family.getTimezone());
        }

        public void requireLead() {
            context().requireLead();
        }

        public void requireContributor() {
            context().requireContributor();
        }
    }

    private final AccountRepository accounts;
    private final MemberRepository members;
    private final FamilyRepository families;

    public Caller(AccountRepository accounts, MemberRepository members, FamilyRepository families) {
        this.accounts = accounts;
        this.members = members;
        this.families = families;
    }

    public Account account() {
        return accounts.findById(CurrentUser.accountId()).orElseThrow(() -> ApiException.unauthorized("Your session has ended. Sign in again."));
    }

    /** Fails with 409 until the person has set up or joined a family. */
    public Membership membership() {
        Account account = account();
        Member member = members.findByAccountId(account.getId()).orElseThrow(() -> ApiException.conflict("Set up your family space first."));
        Family family = families.findById(member.getFamilyId()).orElseThrow(() -> ApiException.conflict("Set up your family space first."));
        return new Membership(account, member, family);
    }
}
