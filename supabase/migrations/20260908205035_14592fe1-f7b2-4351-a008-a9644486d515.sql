DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'sucata_processos_fase_check') THEN
    ALTER TABLE public.sucata_processos DROP CONSTRAINT sucata_processos_fase_check;
  END IF;
END $$;

ALTER TABLE public.sucata_processos
  ADD CONSTRAINT sucata_processos_fase_check
  CHECK (fase = ANY (ARRAY['F01','F02','F03','F04','F05','F06','F07','F08']));