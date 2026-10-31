package com.hearth.ai.application;

import com.hearth.ai.client.AiClient.Reply;
import com.hearth.ai.config.AiProperties;
import com.hearth.ai.domain.AiConsent;
import com.hearth.ai.domain.AiUsage;
import com.hearth.ai.dto.AiDtos.AiStatus;
import com.hearth.ai.repository.AiConsentRepository;
import com.hearth.ai.repository.AiUsageRepository;
import com.hearth.common.error.ApiException;
import com.hearth.common.family.FamilyContext;
import io.micrometer.core.instrument.MeterRegistry;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * The checks every AI request passes before anything is sent to the provider: AI help is configured, the
 * person agreed to it, and they are inside the fair-use limits. Usage is recorded afterwards.
 */
@Component
public class AiGuard {

    public static final String QUICK_ADD = "quick-add";
    public static final String PLAN = "plan";
    public static final String DRAFT = "draft";

    private final AiProperties properties;
    private final AiConsentRepository consents;
    private final AiUsageRepository usage;
    private final Clock clock;
    private final MeterRegistry meters;

    public AiGuard(AiProperties properties, AiConsentRepository consents, AiUsageRepository usage, Clock clock, MeterRegistry meters) {
        this.meters = meters;
        this.properties = properties;
        this.consents = consents;
        this.usage = usage;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public AiStatus status(FamilyContext context) {
        boolean consented = consents.existsById(context.memberId());
        long usedToday = usage.countByMemberIdAndCreatedAtGreaterThanEqual(context.memberId(), startOfToday(context.zone()));
        long tokens = usage.tokensUsedByFamilySince(context.familyId(), startOfMonth(context.zone()));
        int budgetPercent = (int) Math.min(100, Math.round(100.0 * tokens / properties.monthlyTokensPerFamily()));
        return new AiStatus(properties.enabled(), consented, consents.findById(context.memberId()).map(AiConsent::getGrantedAt).orElse(null),
                usedToday, properties.dailyRequestsPerMember(), budgetPercent);
    }

    @Transactional
    public void setConsent(FamilyContext context, boolean granted) {
        if (granted) {
            if (!consents.existsById(context.memberId())) {
                consents.save(new AiConsent(context.memberId(), context.familyId(), Instant.now(clock)));
            }
        } else {
            consents.deleteById(context.memberId());
        }
    }

    /** Throws if this request may not go to the provider. */
    @Transactional(readOnly = true)
    public void check(FamilyContext context) {
        if (!properties.enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "AI help is switched off on this Hearth. You can still add and plan everything yourself.");
        }
        if (!consents.existsById(context.memberId())) {
            throw ApiException.forbidden("Turn on AI help in Settings first. It explains what is sent and you can turn it off at any time.");
        }
        long today = usage.countByMemberIdAndCreatedAtGreaterThanEqual(context.memberId(), startOfToday(context.zone()));
        if (today >= properties.dailyRequestsPerMember()) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "You have used today’s AI help. It resets at midnight.");
        }
        if (usage.tokensUsedByFamilySince(context.familyId(), startOfMonth(context.zone())) >= properties.monthlyTokensPerFamily()) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Your family has used this month’s AI help. It resets on the 1st.");
        }
    }

    /** Recorded in its own transaction so it is kept even if turning the reply into drafts fails afterwards. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(FamilyContext context, String feature, Reply reply) {
        usage.save(new AiUsage(context.familyId(), context.memberId(), feature, reply.inputTokens(), reply.outputTokens(), Instant.now(clock)));
        meters.counter("hearth.ai.requests", "feature", feature).increment();
        meters.counter("hearth.ai.tokens", "feature", feature, "direction", "input").increment(reply.inputTokens());
        meters.counter("hearth.ai.tokens", "feature", feature, "direction", "output").increment(reply.outputTokens());
    }

    private Instant startOfToday(ZoneId zone) {
        return LocalDate.now(clock.withZone(zone)).atStartOfDay(zone).toInstant();
    }

    private Instant startOfMonth(ZoneId zone) {
        return LocalDate.now(clock.withZone(zone)).withDayOfMonth(1).atStartOfDay(zone).toInstant();
    }
}
