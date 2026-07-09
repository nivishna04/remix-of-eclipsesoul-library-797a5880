
CREATE POLICY "Authenticated can read book covers" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'book-covers');
CREATE POLICY "Admins can upload book covers" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update book covers" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete book covers" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'book-covers' AND public.has_role(auth.uid(), 'admin'));
