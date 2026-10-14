package com.hearth.care.infrastructure.storage;

import java.io.IOException;
import java.io.InputStream;
import org.springframework.core.io.Resource;

/**
 * Where document files are kept. The local-disk implementation is enough for
 * one server; an S3 or MinIO implementation can replace it without touching
 * {@code DocumentService}.
 */
public interface FileStorage {

    void store(String key, InputStream content) throws IOException;

    Resource load(String key);

    void delete(String key);
}
