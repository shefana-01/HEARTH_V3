package com.hearth.ai.repository;

import com.hearth.ai.domain.AiUsage;
import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AiUsageRepository extends JpaRepository<AiUsage, UUID> {

    long countByMemberIdAndCreatedAtGreaterThanEqual(UUID memberId, Instant since);

    @Query("select coalesce(sum(u.inputTokens + u.outputTokens), 0) from AiUsage u where u.familyId = :familyId and u.createdAt >= :since")
    long tokensUsedByFamilySince(@Param("familyId") UUID familyId, @Param("since") Instant since);
}
