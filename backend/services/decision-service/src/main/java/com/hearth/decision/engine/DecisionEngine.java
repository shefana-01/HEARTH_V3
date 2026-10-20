package com.hearth.decision.engine;

import com.hearth.common.family.Availability;
import com.hearth.common.family.Availability.TimeWindow;
import com.hearth.decision.engine.Model.Appointment;
import com.hearth.decision.engine.Model.BusyBlock;
import com.hearth.decision.engine.Model.CandidateScore;
import com.hearth.decision.engine.Model.Conflict;
import com.hearth.decision.engine.Model.EngineData;
import com.hearth.decision.engine.Model.Member;
import com.hearth.decision.engine.Model.PriorityBreakdown;
import com.hearth.decision.engine.Model.PriorityFactors;
import com.hearth.decision.engine.Model.RankedTask;
import com.hearth.decision.engine.Model.SimulationChange;
import com.hearth.decision.engine.Model.SimulationResult;
import com.hearth.decision.engine.Model.SuitabilityFactors;
import com.hearth.decision.engine.Model.Task;
import com.hearth.decision.engine.Model.Unavailability;
import com.hearth.decision.engine.Model.Workload;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.ToDoubleFunction;

/**
 * The decision engine. It answers four questions:
 * <ol>
 *   <li>Which tasks cannot go ahead as planned? ({@link #detectConflicts})</li>
 *   <li>Who is the best person to take a task over? ({@link #scoreCandidates})</li>
 *   <li>How pressing is a task? ({@link #priorityScore})</li>
 *   <li>In what order should one person do their tasks? ({@link #rankTasks})</li>
 * </ol>
 * and simulates what-if changes ({@link #simulate}). Every method is pure: the same input always gives
 * the same output.
 *
 * <p>This is a line-by-line port of the reference implementation in
 * {@code frontend/src/services/decision/engine.ts}, which runs the offline demo. DecisionEngineParityTest
 * replays random families through both and requires identical results, wording included. If you change a
 * rule or a weight, change both and regenerate the test data ({@code node tools/engine-fixtures.mjs}).
 */
public final class DecisionEngine {

    /* ───────── weights ───────── */

    /** Task Priority Score: P = wD·D + wC·C + wI·I + wR·R + wS·S (weights sum to 1). */
    public static final double W_DEADLINE = 0.25;
    public static final double W_CRITICALITY = 0.25;
    public static final double W_DEPENDENCY = 0.15;
    public static final double W_REASSIGNMENT = 0.15;
    public static final double W_CONFLICT = 0.2;

    /** Candidate Suitability Score: w1·Availability + w2·WorkloadCapacity + w3·SkillEligibility − w4·ConflictCost. */
    public static final double W_AVAILABILITY = 0.35;
    public static final double W_WORKLOAD = 0.2;
    public static final double W_SKILL = 0.25;
    public static final double W_CONFLICT_COST = 0.3;

    /** Minutes of tasks and appointments in one day that count as a "full" load. */
    private static final double FULL_DAY_LOAD_MIN = 240;

    private static final Map<String, List<String>> CATEGORY_SKILLS = Map.ofEntries(
            Map.entry("medication", List.of("medication", "clinical")),
            Map.entry("health", List.of("clinical", "medication")),
            Map.entry("meals", List.of("meals")),
            Map.entry("errands", List.of("errands", "driving")),
            Map.entry("household", List.of("household")),
            Map.entry("childcare", List.of("childcare")),
            Map.entry("transport", List.of("driving")),
            Map.entry("study", List.of()),
            Map.entry("work", List.of()),
            Map.entry("exercise", List.of("mobility")),
            Map.entry("family", List.of("companionship")),
            Map.entry("other", List.of()));

    /** Getting these wrong affects someone's health or safety. */
    private static final Set<String> CRITICAL_CATEGORIES = Set.of("medication", "health", "transport", "childcare");

    private static final long MIN = 60_000;
    private static final String PERSONAL = "a personal commitment";

    private DecisionEngine() {
    }

    /** Something a member is already committed to. Tasks and appointments are duties (they count as workload); personal events are not. */
    record Commitment(String id, String label, long start, long end, boolean duty) {
    }

    /* ───────── helpers ───────── */

    static long taskStart(Task t) {
        return t.start().toEpochMilli();
    }

    static long taskEnd(Task t) {
        return taskStart(t) + t.durationMin() * MIN;
    }

    private static long overlap(long a0, long a1, long b0, long b1) {
        return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
    }

    private static boolean sameDay(long a, long b, EngineData data) {
        return Instant.ofEpochMilli(a).atZone(data.zone()).toLocalDate().equals(Instant.ofEpochMilli(b).atZone(data.zone()).toLocalDate());
    }

    private static String quoted(String title) {
        return "“" + title + "”";
    }

    private static String firstName(String name) {
        return name == null ? "" : name.split(" ", -1)[0];
    }

    private static int toMinutes(String hhmm) {
        String[] parts = hhmm.split(":");
        return Integer.parseInt(parts[0]) * 60 + Integer.parseInt(parts[1]);
    }

    /** JavaScript's Math.round (halves go up). */
    private static long round(double value) {
        return (long) Math.floor(value + 0.5);
    }

    /** JavaScript's Number(x.toFixed(2)). */
    private static double fixed2(double value) {
        return new BigDecimal(value).setScale(2, RoundingMode.HALF_UP).doubleValue();
    }

    /* ───────── commitments and availability ───────── */

    /** Everything a member is already committed to: their tasks, appointments they attend or go along to, and their personal events. */
    static List<Commitment> commitmentsFor(String memberId, EngineData data, String excludeTaskId) {
        boolean mine = memberId.equals(data.viewerId());
        List<Task> own = data.tasks().stream().filter(t -> memberId.equals(t.assigneeId()) && t.isScheduled()).toList();
        List<Commitment> result = new ArrayList<>();
        for (Task t : own) {
            if (t.id().equals(excludeTaskId)) {
                continue;
            }
            result.add(new Commitment(t.id(), t.isPrivate() && !mine ? PERSONAL : quoted(t.title()), taskStart(t), taskEnd(t), true));
        }
        // An appointment that one of this member's own tasks is linked to is already represented by that task.
        Set<String> linked = new HashSet<>();
        for (Task t : own) {
            if (t.appointmentId() != null) {
                linked.add(t.appointmentId());
            }
        }
        for (Appointment a : data.appointments()) {
            if ((memberId.equals(a.forId()) || memberId.equals(a.escortId())) && !linked.contains(a.id())) {
                long start = a.start().toEpochMilli();
                String label = a.isPrivate() && !mine ? PERSONAL : memberId.equals(a.forId()) ? quoted(a.title()) : quoted(a.title()) + " (going along)";
                result.add(new Commitment(a.id(), label, start, start + a.durationMin() * MIN, true));
            }
        }
        for (BusyBlock b : data.busy()) {
            if (memberId.equals(b.memberId())) {
                result.add(new Commitment(b.id(), b.hidden() && !mine ? PERSONAL : quoted(b.label()), b.start().toEpochMilli(), b.end().toEpochMilli(), false));
            }
        }
        return result;
    }

    /**
     * How well a time range sits inside a member's weekly availability. 1 = fully inside a window, 0.5 = on
     * an available day but outside the windows, 0.2 = a day they marked as off. With no windows set: 0.9 if
     * they keep their calendar in Hearth (so a clear calendar means something), otherwise 0.6 (unknown).
     */
    static double availabilityFit(Member member, long start, long end, EngineData data) {
        Availability availability = member.availability();
        List<TimeWindow> windows = availability == null ? List.of() : availability.windowsOrEmpty();
        if (windows.isEmpty()) {
            return data != null && data.calendarOwners().contains(member.id()) ? 0.9 : 0.6;
        }
        ZonedDateTime date = Instant.ofEpochMilli(start).atZone(data.zone());
        int dayIndex = date.getDayOfWeek().getValue() - 1;
        if (!availability.availableOn(dayIndex)) {
            return 0.2;
        }
        double s = date.getHour() * 60 + date.getMinute();
        double e = s + (double) (end - start) / MIN;
        return windows.stream().anyMatch(w -> toMinutes(w.start()) <= s && toMinutes(w.end()) >= e) ? 1 : 0.5;
    }

    private static Unavailability reportedUnavailable(String memberId, long start, long end, EngineData data) {
        for (Unavailability u : data.unavailability()) {
            if (u.memberId().equals(memberId) && overlap(start, end, u.start().toEpochMilli(), u.end().toEpochMilli()) > 0) {
                return u;
            }
        }
        return null;
    }

    /* ───────── 1. conflicts ───────── */

    /** One conflict per scheduled, not-yet-finished task (the most severe one). Conflicts the owner chose to keep are left out. */
    public static List<Conflict> detectConflicts(EngineData data, Instant now) {
        Map<String, Task> byId = new HashMap<>();
        data.tasks().forEach(t -> byId.putIfAbsent(t.id(), t));
        return detectRaw(data, now.toEpochMilli()).stream().filter(c -> !Objects.equals(byId.get(c.taskId()).acknowledgedConflict(), c.kind())).toList();
    }

    private static List<Conflict> detectRaw(EngineData data, long now) {
        List<Conflict> conflicts = new ArrayList<>();
        Map<String, Member> memberById = new HashMap<>();
        data.members().forEach(m -> memberById.put(m.id(), m));

        for (Task task : data.tasks()) {
            if (!task.isScheduled() || taskEnd(task) < now) {
                continue;
            }
            // A private task is its owner's business: nobody else is told it clashes.
            if (task.isPrivate() && !Objects.equals(task.assigneeId(), data.viewerId())) {
                continue;
            }
            long start = taskStart(task);
            long end = taskEnd(task);

            if (task.assigneeId() == null || !memberById.containsKey(task.assigneeId())) {
                conflicts.add(new Conflict("c-" + task.id(), task.id(), null, "unassigned", "No one has taken this task yet.", 0, null));
                continue;
            }
            Member member = memberById.get(task.assigneeId());
            // Written to the person reading it: "You also have…" for their own tasks, "Rafid also has…" otherwise.
            boolean own = member.id().equals(data.viewerId());
            String first = firstName(member.name());

            Unavailability away = reportedUnavailable(member.id(), start, end, data);
            if (away != null) {
                String reason = away.reason() == null || away.reason().isEmpty() ? "" : " (" + away.reason().toLowerCase() + ")";
                conflicts.add(new Conflict("c-" + task.id(), task.id(), member.id(), "reported-unavailable",
                        (own ? "You said you are" : first + " said they are") + " unavailable" + reason + ".",
                        task.durationMin(), away.reason() == null || away.reason().isEmpty() ? "Unavailable" : away.reason()));
                continue;
            }

            Commitment clash = null;
            double clashMinutes = 0;
            for (Commitment c : commitmentsFor(member.id(), data, task.id())) {
                double minutes = (double) overlap(start, end, c.start(), c.end()) / MIN;
                if (minutes <= 0) {
                    continue;
                }
                if (clash == null || minutes > clashMinutes || minutes == clashMinutes && c.id().compareTo(clash.id()) < 0) {
                    clash = c;
                    clashMinutes = minutes;
                }
            }
            if (clash != null) {
                conflicts.add(new Conflict("c-" + task.id(), task.id(), member.id(), "overlap",
                        (own ? "You also have" : first + " also has") + " " + clash.label() + " then — they overlap by " + round(clashMinutes) + " min.",
                        (int) round(clashMinutes), clash.label()));
                continue;
            }

            if (!member.availability().windowsOrEmpty().isEmpty() && availabilityFit(member, start, end, data) < 1) {
                conflicts.add(new Conflict("c-" + task.id(), task.id(), member.id(), "outside-availability",
                        "This is outside the times " + (own ? "you are" : first + " is") + " usually free.", 0, null));
            }
        }
        return conflicts;
    }

    /** Minutes of tasks and appointments a member has on the day of {@code at}. Personal events are not counted. */
    public static double dayLoadMinutes(String memberId, Instant at, EngineData data) {
        return dayLoadMinutes(memberId, at.toEpochMilli(), data, null);
    }

    private static double dayLoadMinutes(String memberId, long at, EngineData data, String excludeTaskId) {
        double sum = 0;
        for (Commitment c : commitmentsFor(memberId, data, excludeTaskId)) {
            if (c.duty() && sameDay(c.start(), at, data)) {
                sum += (double) (c.end() - c.start()) / MIN;
            }
        }
        return sum;
    }

    /* ───────── 2. candidates ───────── */

    /** Candidate Suitability Score for everyone who could take the task, best first. A private task has no candidates. */
    public static List<CandidateScore> scoreCandidates(Task task, EngineData data) {
        if (task.isPrivate()) {
            return List.of();
        }
        long start = taskStart(task);
        long end = taskEnd(task);
        List<String> needed = CATEGORY_SKILLS.getOrDefault(task.category(), List.of());
        double maxRaw = W_AVAILABILITY + W_WORKLOAD + W_SKILL;

        List<CandidateScore> result = new ArrayList<>();
        for (Member m : data.members()) {
            if (m.id().equals(task.assigneeId()) || !"active".equals(m.status()) || "observer".equals(m.role())) {
                continue;
            }
            String first = firstName(m.name());
            List<String> reasons = new ArrayList<>();
            List<String> cautions = new ArrayList<>();
            List<Commitment> commitments = commitmentsFor(m.id(), data, task.id());

            Unavailability away = reportedUnavailable(m.id(), start, end, data);
            double overlapMin = 0;
            for (Commitment c : commitments) {
                overlapMin += (double) overlap(start, end, c.start(), c.end()) / MIN;
            }
            double conflictCost = Math.min(1, overlapMin / Math.max(task.durationMin(), 1) + (away != null ? 1 : 0));

            // Being away rules someone out; a clash caps how available they can count as.
            double availability = away != null ? 0 : availabilityFit(m, start, end, data);
            if (overlapMin > 0) {
                availability = Math.min(availability, 0.5);
            }
            if (away != null) {
                cautions.add(first + " said they are unavailable at this time.");
            } else if (overlapMin > 0) {
                cautions.add("Already has something else then (" + round(overlapMin) + " min overlap).");
            } else if (availability == 1) {
                reasons.add("Free during this time.");
            } else if (availability == 0.9) {
                reasons.add("Nothing on their calendar at this time.");
            } else if (availability == 0.6) {
                cautions.add(first + " hasn’t shared their schedule yet.");
            } else {
                cautions.add("Outside the times they are usually free.");
            }

            List<Commitment> duties = commitments.stream().filter(c -> c.duty() && sameDay(c.start(), start, data)).toList();
            double load = 0;
            for (Commitment c : duties) {
                load += (double) (c.end() - c.start()) / MIN;
            }
            double workloadCapacity = Math.max(0, 1 - load / FULL_DAY_LOAD_MIN);
            int tasksThatDay = duties.size();
            if (tasksThatDay == 0) {
                reasons.add("No other tasks that day.");
            } else if (workloadCapacity >= 0.6) {
                reasons.add("Light day — " + tasksThatDay + " other task" + (tasksThatDay > 1 ? "s" : "") + ".");
            } else {
                cautions.add("Busy day — " + round(load / 60) + " h of tasks already.");
            }

            List<String> skills = m.skills() == null ? List.of() : m.skills();
            boolean hasSkill = needed.isEmpty() || needed.stream().anyMatch(skills::contains);
            double skillEligibility = hasSkill ? 1 : 0.5;
            if (hasSkill && !needed.isEmpty()) {
                reasons.add("Can help with " + String.join(" & ", needed.stream().filter(skills::contains).toList()) + ".");
            } else if (!hasSkill) {
                cautions.add("Hasn’t listed " + String.join(" or ", needed) + " as something they help with.");
            }

            double raw = W_AVAILABILITY * availability + W_WORKLOAD * workloadCapacity + W_SKILL * skillEligibility - W_CONFLICT_COST * conflictCost;
            int score = (int) round(Math.max(0, Math.min(1, raw / maxRaw)) * 100);

            result.add(new CandidateScore(m.id(), score, new SuitabilityFactors(availability, fixed2(workloadCapacity), skillEligibility, fixed2(conflictCost)),
                    tasksThatDay, (int) round(overlapMin), reasons, cautions));
        }
        result.sort(Comparator.comparingInt(CandidateScore::score).reversed());
        return result;
    }

    /* ───────── 3. priority ───────── */

    /** Task Priority Score, with a plain-language explanation. */
    public static PriorityBreakdown priorityScore(Task task, EngineData data, Conflict conflict, Instant nowInstant) {
        long now = nowInstant.toEpochMilli();
        double hours = (double) (taskStart(task) - now) / 3_600_000;
        double deadline = hours <= 2 ? 1 : hours <= 6 ? 0.8 : hours <= 24 ? 0.6 : hours <= 72 ? 0.35 : 0.15;

        double base = "urgent".equals(task.priority()) ? 0.85 : "important".equals(task.priority()) ? 0.6 : 0.3;
        boolean critical = CRITICAL_CATEGORIES.contains(task.category());
        double criticality = Math.min(1, base + (critical ? 0.15 : 0));

        double dependency = task.appointmentId() != null ? 1
                : "transport".equals(task.category()) ? 0.8
                : "medication".equals(task.category()) || "childcare".equals(task.category()) ? 0.6
                : 0.3;

        // How hard it would be to find someone else. A private task can only be done by its owner.
        List<CandidateScore> candidates = scoreCandidates(task, data);
        long good = candidates.stream().filter(c -> c.score() >= 60).count();
        double reassignment = candidates.isEmpty() ? 1 : 1 - (double) good / candidates.size();

        double conflictSeverity = 0;
        if (conflict != null) {
            if ("unassigned".equals(conflict.kind()) || "reported-unavailable".equals(conflict.kind())) {
                conflictSeverity = 1;
            } else if ("overlap".equals(conflict.kind())) {
                conflictSeverity = 0.2 + 0.8 * Math.min(1, (double) conflict.overlapMinutes() / Math.max(task.durationMin(), 1));
            } else {
                conflictSeverity = 0.4;
            }
        }

        PriorityFactors factors = new PriorityFactors(deadline, criticality, dependency, fixed2(reassignment), fixed2(conflictSeverity));
        int score = (int) round(100 * (W_DEADLINE * deadline + W_CRITICALITY * criticality + W_DEPENDENCY * dependency + W_REASSIGNMENT * reassignment + W_CONFLICT * conflictSeverity));

        List<String> parts = new ArrayList<>();
        if (hours < 0) {
            parts.add("it is already due");
        } else if (hours <= 6) {
            parts.add("it starts in " + (hours < 1 ? "under an hour" : round(hours) + " h"));
        }
        if (critical && criticality >= 0.75) {
            parts.add("it matters for someone’s health or safety");
        } else if ("urgent".equals(task.priority())) {
            parts.add("it is marked urgent");
        }
        if (task.appointmentId() != null) {
            parts.add("an appointment depends on it");
        }
        if (conflictSeverity >= 0.6) {
            parts.add("the current plan cannot go ahead");
        }
        if (task.isPrivate()) {
            parts.add("only you can do it");
        } else if (reassignment >= 0.6) {
            parts.add("few people are free to take it");
        }
        String reasons = String.join(", ", parts);
        String capitalised = reasons.isEmpty() ? reasons : Character.toUpperCase(reasons.charAt(0)) + reasons.substring(1);
        String explanation = parts.isEmpty() ? "Nothing is pressing on this task right now."
                : score >= 70 ? "Ranked high because " + reasons + "."
                : score >= 45 ? "Medium priority. " + capitalised + "."
                : "Low priority for now. Worth knowing: " + reasons + ".";
        return new PriorityBreakdown(score, factors, explanation);
    }

    /* ───────── 4. ranking ───────── */

    /** A task with its Priority Score: what the ordering compares. */
    public record Scored(Task task, PriorityBreakdown priority) {
    }

    private record TieBreaker(String because, Comparator<Scored> compare) {
    }

    /**
     * What decides the order when two tasks have the same Priority Score, in turn: the one due sooner, the
     * one more depends on, the one that is harder to hand over, the one that matters more, the quicker one.
     * The id is the last resort, so the order never changes between two looks at the same data.
     */
    private static final List<TieBreaker> TIE_BREAKERS = List.of(
            new TieBreaker("it is due sooner", Comparator.comparingLong(s -> taskStart(s.task()))),
            new TieBreaker("more depends on it", descending(s -> s.priority().factors().dependency())),
            new TieBreaker("it is harder to hand over", descending(s -> s.priority().factors().reassignment())),
            new TieBreaker("it matters more", descending(s -> s.priority().factors().criticality())),
            new TieBreaker("it is quicker to finish", Comparator.comparingInt(s -> s.task().durationMin())));

    private static Comparator<Scored> descending(ToDoubleFunction<Scored> key) {
        return (a, b) -> Double.compare(key.applyAsDouble(b), key.applyAsDouble(a));
    }

    /** Highest Priority Score first, then the tie-breakers in order, then the id. */
    public static int compareByPriority(Scored a, Scored b) {
        if (a.priority().score() != b.priority().score()) {
            return Integer.compare(b.priority().score(), a.priority().score());
        }
        for (TieBreaker rule : TIE_BREAKERS) {
            int diff = rule.compare().compare(a, b);
            if (diff != 0) {
                return diff;
            }
        }
        return a.task().id().compareTo(b.task().id());
    }

    /** Why {@code first} is placed before {@code second} although both have the same score; null if the scores differ. */
    static String tieBreakReason(Scored first, Scored second) {
        if (first.priority().score() != second.priority().score()) {
            return null;
        }
        for (TieBreaker rule : TIE_BREAKERS) {
            if (rule.compare().compare(first, second) != 0) {
                return "Same score as " + quoted(second.task().title()) + ". This one comes first because " + rule.because() + ".";
            }
        }
        return "Same score as " + quoted(second.task().title()) + ", and nothing sets them apart — do either first.";
    }

    private static int adviceOrder(String advice) {
        return switch (advice) {
            case "now" -> 0;
            case "next" -> 1;
            default -> 2;
        };
    }

    /**
     * One person's open tasks in the order to do them. Time comes first: {@code now} = starts within two
     * hours or is overdue, {@code next} = later the same day, {@code later} = from tomorrow on. Inside each
     * group the Priority Score decides, then the tie-breakers.
     */
    public static List<RankedTask> rankTasks(String memberId, EngineData data, Instant nowInstant) {
        long now = nowInstant.toEpochMilli();
        EngineData view = data.withViewer(memberId);
        Map<String, Conflict> conflicts = new HashMap<>();
        for (Conflict c : detectConflicts(view, nowInstant)) {
            conflicts.put(c.taskId(), c);
        }
        record Item(Task task, Conflict conflict, PriorityBreakdown priority, long startsInMin, String advice) {
            Scored scored() {
                return new Scored(task, priority);
            }
        }
        List<Item> items = new ArrayList<>();
        for (Task task : view.tasks()) {
            if (!memberId.equals(task.assigneeId()) || !task.isScheduled()) {
                continue;
            }
            long startsInMin = round((double) (taskStart(task) - now) / MIN);
            String advice = startsInMin <= 120 ? "now" : sameDay(taskStart(task), now, view) ? "next" : "later";
            Conflict conflict = conflicts.get(task.id());
            items.add(new Item(task, conflict, priorityScore(task, view, conflict, nowInstant), startsInMin, advice));
        }
        items.sort(Comparator.<Item>comparingInt(i -> adviceOrder(i.advice())).thenComparing((a, b) -> compareByPriority(a.scored(), b.scored())));

        List<RankedTask> ranked = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            Item item = items.get(i);
            Item next = i + 1 < items.size() ? items.get(i + 1) : null;
            String tieBreak = next != null && next.advice().equals(item.advice()) ? tieBreakReason(item.scored(), next.scored()) : null;
            ranked.add(new RankedTask(item.task(), i + 1, item.priority(), item.conflict(), item.advice(), tieBreak, item.startsInMin()));
        }
        return ranked;
    }

    /* ───────── what-if ───────── */

    /** Applies a hypothetical change and compares conflicts and workload. Nothing is saved. */
    public static SimulationResult simulate(SimulationChange change, EngineData data, Instant nowInstant) {
        Task target = data.tasks().stream().filter(t -> t.id().equals(change.taskId())).findFirst().orElse(null);
        List<Task> changed = data.tasks().stream()
                .map(t -> t.id().equals(change.taskId()) ? t.withPlan(change.changeAssignee() ? change.assigneeId() : t.assigneeId(), change.start() != null ? change.start() : t.start()) : t)
                .toList();
        EngineData after = data.withTasks(changed);
        List<Conflict> before = detectConflicts(data, nowInstant);
        List<Conflict> afterConflicts = detectConflicts(after, nowInstant);
        Set<String> beforeKeys = new HashSet<>();
        before.forEach(c -> beforeKeys.add(c.taskId() + ":" + c.kind()));
        Set<String> afterKeys = new HashSet<>();
        afterConflicts.forEach(c -> afterKeys.add(c.taskId() + ":" + c.kind()));

        long day = target != null ? taskStart(target) : nowInstant.toEpochMilli();
        long changedDay = change.start() != null ? change.start().toEpochMilli() : day;
        List<Workload> workload = new ArrayList<>();
        for (Member m : data.members()) {
            if (!"active".equals(m.status())) {
                continue;
            }
            long beforeLoad = round(dayLoadMinutes(m.id(), day, data, null));
            long afterLoad = round(dayLoadMinutes(m.id(), changedDay, after, null));
            boolean involved = m.id().equals(target == null ? null : target.assigneeId()) || m.id().equals(change.assigneeId());
            if (beforeLoad != afterLoad || involved) {
                workload.add(new Workload(m.id(), beforeLoad, afterLoad));
            }
        }
        return new SimulationResult(
                change,
                before,
                afterConflicts,
                before.stream().filter(c -> !afterKeys.contains(c.taskId() + ":" + c.kind())).toList(),
                afterConflicts.stream().filter(c -> !beforeKeys.contains(c.taskId() + ":" + c.kind())).toList(),
                workload);
    }
}
