SELECT MAX(m.id) max,
    m.data:foo:bar AS db,
    m.data['foo'] AS db2,
    m.data['foo'][0] AS db3,
    m.data:foo.bar AS db4
-- <- keyword
    -- ^ function.call
        -- ^ type
          -- ^ field
              -- ^ variable
FROM my_table m
-- <- keyword
  -- ^ type
           -- ^ variable
WHERE m.id > 4
-- <- keyword
     -- ^ field
        -- ^ operator
          -- ^ string
  AND m.title LIKE '%foo%';
  -- <- keyword.operator
                -- ^ string
