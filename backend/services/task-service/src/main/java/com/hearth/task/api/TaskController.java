package com.hearth.task.api;

import com.hearth.task.application.TaskService;
import com.hearth.task.dto.TaskDtos.AssigneeRequest;
import com.hearth.task.dto.TaskDtos.TaskInput;
import com.hearth.task.dto.TaskDtos.TaskView;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/tasks")
public class TaskController {

    private final TaskService tasks;

    public TaskController(TaskService tasks) {
        this.tasks = tasks;
    }

    /** Tasks the caller may see, earliest first. Cancelled ones only when asked for. */
    @GetMapping
    public List<TaskView> list(@RequestParam(required = false) UUID assigneeId, @RequestParam(defaultValue = "false") boolean includeCancelled) {
        return tasks.list(assigneeId, includeCancelled);
    }

    @GetMapping("/{id}")
    public TaskView get(@PathVariable UUID id) {
        return tasks.get(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TaskView create(@Valid @RequestBody TaskInput input) {
        return tasks.create(input);
    }

    @PutMapping("/{id}")
    public TaskView update(@PathVariable UUID id, @Valid @RequestBody TaskInput input) {
        return tasks.update(id, input);
    }

    @PostMapping("/{id}/complete")
    public TaskView complete(@PathVariable UUID id) {
        return tasks.complete(id);
    }

    @PostMapping("/{id}/reopen")
    public TaskView reopen(@PathVariable UUID id) {
        return tasks.reopen(id);
    }

    /** Cancels the task (it stays in the history). */
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void cancel(@PathVariable UUID id) {
        tasks.cancel(id);
    }

    @PutMapping("/{id}/assignee")
    public TaskView assign(@PathVariable UUID id, @RequestBody AssigneeRequest request) {
        return tasks.assign(id, request.memberId());
    }
}
