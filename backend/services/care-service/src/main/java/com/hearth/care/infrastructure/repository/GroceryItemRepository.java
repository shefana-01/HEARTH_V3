package com.hearth.care.infrastructure.repository;

import com.hearth.care.domain.GroceryItem;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GroceryItemRepository extends JpaRepository<GroceryItem, UUID> {

    List<GroceryItem> findByFamilyIdOrderByCreatedAtAsc(UUID familyId);

    Optional<GroceryItem> findByIdAndFamilyId(UUID id, UUID familyId);

    Optional<GroceryItem> findByFamilyIdAndFoodId(UUID familyId, String foodId);
}
