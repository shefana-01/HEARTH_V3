package com.hearth.family.repository;

import com.hearth.family.domain.OneTimeToken;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface OneTimeTokenRepository extends JpaRepository<OneTimeToken, UUID> {

    Optional<OneTimeToken> findByTokenHash(String tokenHash);

    /** An older link stops working once a new one is sent. */
    @Modifying
    @Query("update OneTimeToken t set t.usedAt = :now where t.accountId = :accountId and t.purpose = :purpose and t.usedAt is null")
    int retireOpen(@Param("accountId") UUID accountId, @Param("purpose") String purpose, @Param("now") Instant now);

    @Modifying
    @Query("delete from OneTimeToken t where t.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
