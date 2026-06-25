-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  bio text,
  favorite_genres text[] DEFAULT '{}',
  language text DEFAULT 'ru',
  created_at timestamp WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all profiles" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

-- Follows
CREATE TABLE IF NOT EXISTS public.follows (
  follower_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  following_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamp WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (follower_id, following_id)
);

ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view follows" ON public.follows FOR SELECT USING (true);
CREATE POLICY "Users can manage own follows" ON public.follows FOR ALL USING (auth.uid() = follower_id);

-- Watched
CREATE TABLE IF NOT EXISTS public.watched (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL CHECK (media_type IN ('movie', 'tv', 'anime')),
  status text NOT NULL CHECK (status IN ('want', 'watching', 'watched')),
  rating numeric(3,1) CHECK (rating >= 1.0 AND rating <= 10.0),
  review text,
  watched_at timestamp WITH TIME ZONE,
  created_at timestamp WITH TIME ZONE DEFAULT now(),
  UNIQUE (user_id, tmdb_id, media_type)
);

ALTER TABLE public.watched ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view watched" ON public.watched FOR SELECT USING (true);
CREATE POLICY "Users can manage own watched" ON public.watched FOR ALL USING (auth.uid() = user_id);

-- Media cache
CREATE TABLE IF NOT EXISTS public.media_cache (
  tmdb_id integer NOT NULL,
  media_type text NOT NULL,
  title text,
  original_title text,
  poster_path text,
  overview text,
  release_date date,
  genres text[] DEFAULT '{}',
  imdb_rating numeric(3,1),
  imdb_votes integer,
  runtime integer,
  countries text[] DEFAULT '{}',
  cast_main jsonb DEFAULT '[]',
  streaming_platforms jsonb DEFAULT '{}',
  cached_at timestamp WITH TIME ZONE DEFAULT now(),
  PRIMARY KEY (tmdb_id, media_type)
);

ALTER TABLE public.media_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read media cache" ON public.media_cache FOR SELECT USING (true);
CREATE POLICY "Service role can write media cache" ON public.media_cache FOR ALL USING (true);

-- Recommendations
CREATE TABLE IF NOT EXISTS public.recommendations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL,
  message text,
  is_read boolean DEFAULT false,
  created_at timestamp WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own recommendations" ON public.recommendations FOR SELECT USING (auth.uid() = to_user_id OR auth.uid() = from_user_id);
CREATE POLICY "Users can create recommendations" ON public.recommendations FOR INSERT WITH CHECK (auth.uid() = from_user_id);
CREATE POLICY "Recipients can mark read" ON public.recommendations FOR UPDATE USING (auth.uid() = to_user_id);

-- Comments
CREATE TABLE IF NOT EXISTS public.comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  tmdb_id integer NOT NULL,
  media_type text NOT NULL,
  content text NOT NULL,
  likes_count integer DEFAULT 0,
  created_at timestamp WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Users can create comments" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- Comment likes
CREATE TABLE IF NOT EXISTS public.comment_likes (
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, comment_id)
);

ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view likes" ON public.comment_likes FOR SELECT USING (true);
CREATE POLICY "Users can manage own likes" ON public.comment_likes FOR ALL USING (auth.uid() = user_id);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES public.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('follow', 'recommendation', 'comment', 'like', 'watched')),
  tmdb_id integer,
  media_type text,
  is_read boolean DEFAULT false,
  created_at timestamp WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can mark notifications read" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, username, full_name, avatar_url)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
