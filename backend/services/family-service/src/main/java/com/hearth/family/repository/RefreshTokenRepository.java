package com.hearth.family.repository;

import com.hearth.family.domain.RefreshToken;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RefreshTokenRepository extends JpaRepository<RefreshToken, UUID> {

    Optional<RefreshToken> findByTokenHash(String tokenHash);

    /** Signs the account out everywhere (after a password change, or when a used token is presented again). */
    @Modifying
    @Query("update RefreshToken t set t.revokedAt = :now where t.accountId = :accountId and t.revokedAt is null")
    int revokeAll(@Param("accountId") UUID accountId, @Param("now") Instant now);

    @Modifying
    @Query("delete from RefreshToken t where t.expiresAt < :cutoff")
    int deleteExpiredBefore(@Param("cutoff") Instant cutoff);
}
