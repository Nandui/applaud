-- Birthday points: make sure Admin > Milestones has a "Birthday" rule to
-- switch on. Databases set up from the seed already have one (kept as it is,
-- switched off by 20260703130000); this only adds it where it's missing, off,
-- so nothing is paid or posted until an admin switches it on.
INSERT INTO "MilestoneRule" ("id", "type", "config", "points", "active")
SELECT 'birthday-rule', 'birthday', '{}'::jsonb, 100, false
WHERE NOT EXISTS (SELECT 1 FROM "MilestoneRule" WHERE "type" = 'birthday');
