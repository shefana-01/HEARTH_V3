package com.hearth.notification.live;

import com.hearth.common.family.FamilyContext;
import com.hearth.common.family.FamilyDirectory;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

/** Server-sent events: "something changed in tasks / chat / ...", so open pages refresh by themselves. */
@RestController
@RequestMapping("/api/v1/notifications")
public class LiveController {

    private final FamilyDirectory directory;
    private final LiveUpdates live;

    public LiveController(FamilyDirectory directory, LiveUpdates live) {
        this.directory = directory;
        this.live = live;
    }

    @GetMapping(path = "/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public SseEmitter stream() {
        FamilyContext context = directory.context();
        return live.open(context.familyId(), context.memberId());
    }
}
