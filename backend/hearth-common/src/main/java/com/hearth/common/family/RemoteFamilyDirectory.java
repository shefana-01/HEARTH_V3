package com.hearth.common.family;

import com.hearth.common.http.ServiceClient;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.context.request.RequestContextHolder;

/**
 * Asks family-service who the caller is, passing the caller's own token along.
 * The answer is kept for the rest of the request only, so a removed member
 * loses access on their very next call. (A short Redis cache could go here if
 * this ever becomes a bottleneck.)
 */
@Component
@ConditionalOnProperty(name = "hearth.services.family")
public class RemoteFamilyDirectory implements FamilyDirectory {

    private static final String CONTEXT_ATTRIBUTE = "hearth.familyContext";
    private static final String MEMBERS_ATTRIBUTE = "hearth.familyMembers";

    private final ServiceClient client;
    private final String familyServiceUrl;

    public RemoteFamilyDirectory(ServiceClient client, @Value("${hearth.services.family}") String familyServiceUrl) {
        this.client = client;
        this.familyServiceUrl = familyServiceUrl;
    }

    @Override
    public FamilyContext context() {
        RequestAttributes request = RequestContextHolder.getRequestAttributes();
        if (request != null && request.getAttribute(CONTEXT_ATTRIBUTE, RequestAttributes.SCOPE_REQUEST) instanceof FamilyContext cached) {
            return cached;
        }
        FamilyContext context = client.get(familyServiceUrl + "/api/v1/internal/context", FamilyContext.class);
        if (request != null) {
            request.setAttribute(CONTEXT_ATTRIBUTE, context, RequestAttributes.SCOPE_REQUEST);
        }
        return context;
    }

    @Override
    @SuppressWarnings("unchecked")
    public List<MemberRef> members() {
        RequestAttributes request = RequestContextHolder.getRequestAttributes();
        if (request != null && request.getAttribute(MEMBERS_ATTRIBUTE, RequestAttributes.SCOPE_REQUEST) instanceof List<?> cached) {
            return (List<MemberRef>) cached;
        }
        List<MemberRef> members = client.get(familyServiceUrl + "/api/v1/members", new ParameterizedTypeReference<List<MemberRef>>() {
        });
        if (request != null) {
            request.setAttribute(MEMBERS_ATTRIBUTE, members, RequestAttributes.SCOPE_REQUEST);
        }
        return members;
    }
}
