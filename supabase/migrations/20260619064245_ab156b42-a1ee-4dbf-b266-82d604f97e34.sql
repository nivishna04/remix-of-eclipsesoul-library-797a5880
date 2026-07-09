
-- Roles enum and table
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  department TEXT,
  year TEXT,
  student_code TEXT UNIQUE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles select own or admin" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles update own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Profiles insert own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Auto-create profile + default student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'student'));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Books
CREATE TABLE public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  publisher TEXT,
  category TEXT,
  isbn TEXT UNIQUE,
  barcode TEXT UNIQUE,
  quantity INT NOT NULL DEFAULT 1,
  available_copies INT NOT NULL DEFAULT 1,
  cover_url TEXT,
  shelf_location TEXT,
  description TEXT,
  published_year INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.books TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.books TO authenticated;
GRANT ALL ON public.books TO service_role;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Books readable by all" ON public.books FOR SELECT USING (true);
CREATE POLICY "Books admin write" ON public.books FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Transactions (issues + returns)
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issue_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  due_date TIMESTAMPTZ NOT NULL,
  return_date TIMESTAMPTZ,
  fine_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  fine_paid BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'issued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tx own or admin" ON public.transactions FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Tx admin write" ON public.transactions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Reservations
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reservations own or admin select" ON public.reservations FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Reservations self insert" ON public.reservations FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Reservations self cancel" ON public.reservations FOR UPDATE TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Reservations admin delete" ON public.reservations FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Lost book reports
CREATE TABLE public.lost_books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending',
  fine_amount NUMERIC(10,2) DEFAULT 0,
  notes TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lost_books TO authenticated;
GRANT ALL ON public.lost_books TO service_role;
ALTER TABLE public.lost_books ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Lost own or admin" ON public.lost_books FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Lost self report" ON public.lost_books FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Lost admin update" ON public.lost_books FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Seats
CREATE TABLE public.seats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  zone TEXT,
  type TEXT NOT NULL DEFAULT 'seat',
  is_active BOOLEAN NOT NULL DEFAULT true
);
GRANT SELECT ON public.seats TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.seats TO authenticated;
GRANT ALL ON public.seats TO service_role;
ALTER TABLE public.seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seats public read" ON public.seats FOR SELECT USING (true);
CREATE POLICY "Seats admin write" ON public.seats FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.seat_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seat_id UUID NOT NULL REFERENCES public.seats(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.seat_reservations TO authenticated;
GRANT ALL ON public.seat_reservations TO service_role;
ALTER TABLE public.seat_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Seat res own or admin" ON public.seat_reservations FOR SELECT TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Seat res self insert" ON public.seat_reservations FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Seat res self update" ON public.seat_reservations FOR UPDATE TO authenticated USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- Activity logs
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.activity_logs TO authenticated;
GRANT ALL ON public.activity_logs TO service_role;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logs admin read" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Logs self insert" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- Seed sample books (covers via Open Library)
INSERT INTO public.books (title, author, publisher, category, isbn, barcode, quantity, available_copies, cover_url, shelf_location, description, published_year) VALUES
('Harry Potter and the Sorcerer''s Stone', 'J.K. Rowling', 'Scholastic', 'Fantasy', '9780439708180', 'ESL-0001', 5, 5, 'https://covers.openlibrary.org/b/isbn/9780439708180-L.jpg', 'A-12', 'The boy who lived begins his journey at Hogwarts.', 1997),
('The Hobbit', 'J.R.R. Tolkien', 'Houghton Mifflin', 'Fantasy', '9780547928227', 'ESL-0002', 4, 4, 'https://covers.openlibrary.org/b/isbn/9780547928227-L.jpg', 'A-14', 'Bilbo Baggins'' unexpected adventure to the Lonely Mountain.', 1937),
('The Alchemist', 'Paulo Coelho', 'HarperOne', 'Fiction', '9780062315007', 'ESL-0003', 6, 6, 'https://covers.openlibrary.org/b/isbn/9780062315007-L.jpg', 'B-03', 'A shepherd''s journey toward his personal legend.', 1988),
('Atomic Habits', 'James Clear', 'Avery', 'Self-Help', '9780735211292', 'ESL-0004', 8, 8, 'https://covers.openlibrary.org/b/isbn/9780735211292-L.jpg', 'C-01', 'Tiny changes, remarkable results.', 2018),
('Rich Dad Poor Dad', 'Robert Kiyosaki', 'Plata Publishing', 'Finance', '9781612680194', 'ESL-0005', 5, 5, 'https://covers.openlibrary.org/b/isbn/9781612680194-L.jpg', 'C-04', 'What the rich teach their kids about money.', 1997),
('Stranger Things: Worlds Turned Upside Down', 'Gina McIntyre', 'Random House', 'Pop Culture', '9781984817426', 'ESL-0006', 3, 3, 'https://covers.openlibrary.org/b/isbn/9781984817426-L.jpg', 'D-11', 'The official behind-the-scenes companion.', 2018),
('The Hitchhiker''s Guide to the Galaxy', 'Douglas Adams', 'Del Rey', 'Science Fiction', '9780345391803', 'ESL-0007', 3, 3, 'https://covers.openlibrary.org/b/isbn/9780345391803-L.jpg', 'E-07', 'The classic comedic science fiction series following Arthur Dent across the universe.', 1979),
('1984', 'George Orwell', 'Signet Classic', 'Dystopian', '9780451524935', 'ESL-0008', 4, 4, 'https://covers.openlibrary.org/b/isbn/9780451524935-L.jpg', 'F-02', 'Big Brother is watching.', 1949),
('To Kill a Mockingbird', 'Harper Lee', 'Harper Perennial', 'Classic', '9780061120084', 'ESL-0009', 4, 4, 'https://covers.openlibrary.org/b/isbn/9780061120084-L.jpg', 'F-05', 'A story of racial injustice in the American South.', 1960),
('The Great Gatsby', 'F. Scott Fitzgerald', 'Scribner', 'Classic', '9780743273565', 'ESL-0010', 4, 4, 'https://covers.openlibrary.org/b/isbn/9780743273565-L.jpg', 'F-06', 'The Jazz Age dream of Jay Gatsby.', 1925),
('Sapiens', 'Yuval Noah Harari', 'Harper', 'History', '9780062316097', 'ESL-0011', 3, 3, 'https://covers.openlibrary.org/b/isbn/9780062316097-L.jpg', 'G-01', 'A brief history of humankind.', 2011),
('Dune', 'Frank Herbert', 'Ace', 'Science Fiction', '9780441172719', 'ESL-0012', 3, 3, 'https://covers.openlibrary.org/b/isbn/9780441172719-L.jpg', 'E-08', 'On the desert planet Arrakis, spice changes everything.', 1965);

-- Seed seats
INSERT INTO public.seats (code, zone, type) VALUES
('S-01', 'Silent Zone', 'seat'),('S-02', 'Silent Zone', 'seat'),('S-03', 'Silent Zone', 'seat'),
('S-04', 'Silent Zone', 'seat'),('G-01', 'Group Study', 'seat'),('G-02', 'Group Study', 'seat'),
('R-01', 'Study Room', 'room'),('R-02', 'Study Room', 'room');
