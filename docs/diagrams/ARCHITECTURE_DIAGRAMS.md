# Hearth Architecture & Design Diagrams (Mermaid)

## 1. System Context Diagram (Level 1)
```mermaid
graph TD
    User["👨‍👩‍👧 Family Members & Caregivers"] -->|Web Browser / Mobile| Hearth["🌿 Hearth Platform"]
    Admin["🛡️ Family Administrator"] -->|Admin Dashboard| Hearth
    
    Hearth -->|Authentication| Keycloak["🔑 Identity Provider"]
    Hearth -->|SMS / Email Alerts| NotificationSvc["📬 Notification Service Provider"]
    Hearth -->|Document Storage| S3["☁️ Object Storage"]
    Hearth -->|Nutritional Dataset| NutritionAPI["🥗 Verified Nutrition Provider"]
```

## 2. Container Architecture (Level 2)
```mermaid
graph TD
    Client["React + TypeScript Frontend (Port 5173)"] -->|HTTPS / REST| Gateway["Spring Cloud API Gateway (Port 8080)"]
    
    Gateway -->|/api/families/**| FamilySvc["Family Service (Port 8081)"]
    Gateway -->|/api/tasks/**| TaskSvc["Task & Schedule Service (Port 8082)"]
    Gateway -->|/api/decisions/**| DecisionSvc["Decision Service (Port 8083)"]
    Gateway -->|/api/care/**| CareSvc["Care & Health Service (Port 8084)"]
    Gateway -->|/api/notifications/**| NotifSvc["Notification & Audit Service (Port 8085)"]
    
    FamilySvc --> DB1[("PostgreSQL: hearth_family")]
    TaskSvc --> DB2[("PostgreSQL: hearth_task")]
    DecisionSvc --> DB3[("PostgreSQL: hearth_decision")]
    CareSvc --> DB4[("PostgreSQL: hearth_care")]
    NotifSvc --> DB5[("PostgreSQL: hearth_notification")]
    
    TaskSvc -.->|Kafka Events: TaskReassigned, TaskCreated| KafkaBus{{"Kafka Event Broker"}}
    KafkaBus -.-> NotifSvc
    KafkaBus -.-> DecisionSvc
```

## 3. Decision Service Internal Components (Level 3)
```mermaid
graph LR
    subgraph Decision Service
        PC["Priority Calculator (FR-08)"]
        CE["Candidate Evaluator (FR-10)"]
        CA["Conflict Analyzer (FR-07)"]
        RG["Recommendation Generator"]
        EB["Explanation Builder"]
        
        PC --> RG
        CE --> RG
        CA --> CE
        RG --> EB
    end
```

## 4. Task State Machine Diagram
```mermaid
stateDiagram-v2
    [*] --> Draft : Create Task (FR-05)
    Draft --> Assigned : Assign Task (FR-06)
    
    state Assigned {
        [*] --> AssignedCore
        AssignedCore --> ConflictFlagged : Detect Conflict (FR-07)
        ConflictFlagged --> AssignedCore : Resolve Conflict
    }
    
    AssignedCore --> Active : Availability Clear
    Active --> Completed : Task Completed
    Active --> Unavailable : Report Unavailability (FR-09)
    
    Unavailable --> Recommended : Decision Engine Ranking (FR-10)
    Recommended --> Active : Reassignment Approved (FR-11)
    Recommended --> AdminFlagged : Reassignment Rejected / No Candidates
    
    Completed --> [*]
```
