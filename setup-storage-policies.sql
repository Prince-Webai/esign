-- Allow anyone to upload images to the form-submissions bucket
CREATE POLICY "Allow Public Uploads"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'form-submissions');

-- Allow anyone to view images in the form-submissions bucket
CREATE POLICY "Allow Public Viewing"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'form-submissions');
