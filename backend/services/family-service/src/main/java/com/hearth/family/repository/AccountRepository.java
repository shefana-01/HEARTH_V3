package com.hearth.family.repository;

import com.hearth.family.domain.Account;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AccountRepository extends JpaRepository<Account, UUID> {

    /** Email addresses are compared without regard to case. */
    @Query("select a from Account a where lower(a.email) = lower(:email)")
    Optional<Account> findByEmail(@Param("email") String email);
}
