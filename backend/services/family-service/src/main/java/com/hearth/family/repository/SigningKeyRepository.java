package com.hearth.family.repository;

import com.hearth.family.domain.SigningKey;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SigningKeyRepository extends JpaRepository<SigningKey, String> {

    Optional<SigningKey> findFirstByOrderByCreatedAtDesc();
}
