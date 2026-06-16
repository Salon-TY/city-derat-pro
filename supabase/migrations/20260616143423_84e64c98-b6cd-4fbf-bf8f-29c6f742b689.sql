
CREATE TABLE public.stock_products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  unite TEXT NOT NULL DEFAULT 'unité',
  quantite NUMERIC NOT NULL DEFAULT 0,
  seuil_alerte NUMERIC NOT NULL DEFAULT 0,
  prix_achat_ht NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_products TO authenticated;
GRANT ALL ON public.stock_products TO service_role;

ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own stock products"
  ON public.stock_products FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_stock_products_updated_at
  BEFORE UPDATE ON public.stock_products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
