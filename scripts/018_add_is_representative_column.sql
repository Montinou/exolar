-- Add is_representative column to failure_cluster_members
-- This marks which test in a cluster is the "most typical" failure (closest to centroid)

ALTER TABLE failure_cluster_members
ADD COLUMN IF NOT EXISTS is_representative BOOLEAN DEFAULT FALSE;

-- Add index for faster lookup of representative failures
CREATE INDEX IF NOT EXISTS idx_cluster_members_representative
ON failure_cluster_members(cluster_id, is_representative);

-- Update existing data: mark the test with smallest distance as representative for each cluster
-- This ensures existing clusters have a representative marked
WITH ranked_members AS (
  SELECT
    id,
    cluster_id,
    ROW_NUMBER() OVER (PARTITION BY cluster_id ORDER BY distance_to_centroid ASC NULLS LAST) as rank
  FROM failure_cluster_members
)
UPDATE failure_cluster_members
SET is_representative = TRUE
FROM ranked_members
WHERE failure_cluster_members.id = ranked_members.id
  AND ranked_members.rank = 1;
