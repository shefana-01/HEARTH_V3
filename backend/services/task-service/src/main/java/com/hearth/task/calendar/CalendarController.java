package com.hearth.task.calendar;

import com.hearth.common.error.ApiException;
import com.hearth.task.calendar.CalendarService.FeedStatus;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/**
 * Calendar sync. {@code /feed} manages the signed-in member's private address; {@code /feeds/{token}.ics} is
 * what calendar apps fetch, without signing in (the token is the secret).
 */
@RestController
@RequestMapping("/api/v1/calendar")
public class CalendarController {

    static final MediaType TEXT_CALENDAR = new MediaType("text", "calendar", StandardCharsets.UTF_8);

    private final CalendarService calendar;

    public CalendarController(CalendarService calendar) {
        this.calendar = calendar;
    }

    @GetMapping("/feed")
    public FeedStatus status() {
        return calendar.status();
    }

    /** A new private address; any older one stops working. The token is returned only here. */
    @PostMapping("/feed")
    @ResponseStatus(HttpStatus.CREATED)
    public FeedStatus create() {
        return calendar.create();
    }

    @DeleteMapping("/feed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void remove() {
        calendar.remove();
    }

    @GetMapping("/feeds/{token}.ics")
    public ResponseEntity<String> feed(@PathVariable String token, @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {
        String body = calendar.render(token).orElseThrow(() -> ApiException.notFound("That calendar"));
        String etag = "\"" + sha256(body.replaceAll("DTSTAMP:[0-9TZ]+\r\n", "")) + "\"";
        CacheControl cache = CacheControl.maxAge(Duration.ofMinutes(15)).cachePrivate();
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).cacheControl(cache).build();
        }
        return ResponseEntity.ok()
                .contentType(TEXT_CALENDAR)
                .eTag(etag)
                .cacheControl(cache)
                .header("X-Robots-Tag", "noindex")
                .header("Content-Disposition", "inline; filename=\"hearth.ics\"")
                .body(body);
    }

    private static String sha256(String text) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))).substring(0, 32);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException(ex);
        }
    }
}
