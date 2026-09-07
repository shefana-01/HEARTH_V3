// Domain Types for Hearth

export type MemberRole = 'ADMIN' | 'MEMBER' | 'CAREGIVER' | 'DEPENDENT';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface Family {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
}

export interface FamilyMember {
  id: string;
  familyId: string;
  userId: string;
  name: string;
  role: MemberRole;
  status: 'ACTIVE' | 'PENDING_INVITE' | 'INACTIVE';
  joinedAt: string;
}

export interface Availability {
  id: string;
  memberId: string;
  dayOfWeek?: number;
  startTime: string;
  endTime: string;
  isRecurring: boolean;
  specificDate?: string;
  isAvailable: boolean;
}

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type TaskStatus = 'DRAFT' | 'ASSIGNED' | 'CONFLICT_FLAGGED' | 'ACTIVE' | 'IN_PROGRESS' | 'COMPLETED' | 'UNAVAILABLE';

export interface Task {
  id: string;
  familyId: string;
  title: string;
  description?: string;
  deadline: string;
  estimatedDurationMinutes: number;
  priority: TaskPriority;
  careCriticality: number; // 0.0 to 1.0
  status: TaskStatus;
  assignedMemberId?: string;
  createdBy: string;
  createdAt: string;
}

export interface Conflict {
  id: string;
  taskId: string;
  memberId: string;
  conflictType: string;
  explanation: string;
  resolved: boolean;
  detectedAt: string;
}

export interface PriorityScore {
  taskId: string;
  totalScore: number;
  deadlineUrgency: number;
  careCriticality: number;
  dependencyImpact: number;
  reassignmentDifficulty: number;
  conflictSeverity: number;
  explanation: string;
}

export interface SuitabilityScore {
  candidateMemberId: string;
  candidateName: string;
  totalScore: number;
  availabilityScore: number;
  workloadCapacityScore: number;
  skillEligibilityScore: number;
  conflictCost: number;
  explanation: string;
}

export interface ReassignmentRecommendation {
  taskId: string;
  taskTitle: string;
  rankedCandidates: SuitabilityScore[];
  topCandidateId?: string;
  recommendationSummary: string;
}

export interface Patient {
  id: string;
  familyId: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  primaryCaregiverId?: string;
}

export interface HealthProfile {
  id: string;
  patientId: string;
  bloodType?: string;
  allergiesSummary?: string;
  dietaryRestrictions?: string;
  emergencyNotes?: string;
  updatedAt: string;
}

export interface Appointment {
  id: string;
  patientId: string;
  caregiverId?: string;
  title: string;
  location?: string;
  scheduledTime: string;
  durationMinutes: number;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
}

export interface NutritionGoal {
  id: string;
  familyId: string;
  goalCategory: string;
  budgetLimit?: number;
  dietaryPreferences?: string;
}

export interface GroceryItem {
  id: string;
  nutritionGoalId: string;
  itemName: string;
  quantity?: string;
  estimatedCost?: number;
  convertedToTaskId?: string;
}

export interface Notification {
  id: string;
  userId: string;
  familyId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}
