package com.hearth.notification.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "audit_logs")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "family_id", nullable = false)
    private UUID familyId;

    @Column(name = "actor_user_id", nullable = false)
    private UUID actorUserId;

    @Column(nullable = false)
    private String action; // e.g. "TASK_REASSIGNED", "MEMBER_INVITED", "ROLE_UPDATED"

    @Column(name = "resource_type", nullable = false)
    private String resourceType; // "TASK", "MEMBER", "APPOINTMENT"

    @Column(name = "resource_id", nullable = false)
    private String resourceId;

    @Column(columnDefinition = "TEXT")
    private String beforeStateJson;

    @Column(columnDefinition = "TEXT")
    private String afterStateJson;

    @Column(name = "timestamp", nullable = false, updatable = false)
    @Builder.Default
    private Instant timestamp = Instant.now();
}
