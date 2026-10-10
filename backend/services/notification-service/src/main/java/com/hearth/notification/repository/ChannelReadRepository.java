package com.hearth.notification.repository;

import com.hearth.notification.entity.ChannelRead;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ChannelReadRepository extends JpaRepository<ChannelRead, UUID> {

    Optional<ChannelRead> findByFamilyIdAndMemberIdAndChannel(UUID familyId, UUID memberId, String channel);

    List<ChannelRead> findByFamilyIdAndMemberId(UUID familyId, UUID memberId);
}
