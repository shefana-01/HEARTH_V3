package com.hearth.common.testing;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/**
 * Import in a service test to replace the call to family-service with {@link FakeFamilyDirectory}. It is
 * the primary {@code FamilyDirectory}, so services get it instead of the remote one.
 */
@TestConfiguration
public class TestFamilyConfig {

    @Bean
    @Primary
    public FakeFamilyDirectory fakeFamilyDirectory() {
        return new FakeFamilyDirectory();
    }
}
