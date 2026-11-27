# Historical assessment fixture

Every clinical value, code, patient and reviewer identity is a placeholder, not clinical guidance.

This SQLite fixture contains historical event shapes and a retained signed placeholder package. Only its public verification key is saved. Tests copy the database before opening it and prove read-time upcasting and exact replay without modifying the stored records. The package intentionally predates the manifest's type-version list.
