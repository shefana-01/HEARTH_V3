package com.hearth.task.domain;

import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "conflicts")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Conflict {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "task_id", nullable = false)
    private UUID taskId;

    @Column(name = "member_id", nullable = false)
    private UUID memberId;

    @Column(name = "conflict_type", nullable = false)
    private String conflictType; // e.g. "AVAILABILITY_OVERLAP", "DOUBLE_BOOKING", "DEPENDENCY_NOT_MET"

    @Column(columnDefinition = "TEXT", nullable = false)
    private String explanation; // Human-understandable explanation (FR-07)

    @Column(nullable = false)
    @Builder.Default
    private Boolean resolved = false;

    @Column(name = "detected_at", nullable = false)
    @Builder.Default
    private Instant detectedAt = Instant.now();
}
