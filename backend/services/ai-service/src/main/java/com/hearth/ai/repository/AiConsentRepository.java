package com.hearth.ai.repository;

import com.hearth.ai.domain.AiConsent;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AiConsentRepository extends JpaRepository<AiConsent, UUID> {
}
