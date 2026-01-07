-- Create profiles table for user data
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create projects table for analysis sessions
CREATE TABLE public.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL DEFAULT 'Untitled Analysis',
    description TEXT,
    video_filename TEXT,
    video_url TEXT,
    thumbnail_url TEXT,
    duration_seconds NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create calibrations table for camera settings per project
CREATE TABLE public.calibrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL DEFAULT 'Default',
    camera_x NUMERIC DEFAULT 0,
    camera_y NUMERIC DEFAULT 50,
    camera_z NUMERIC DEFAULT 80,
    camera_fov NUMERIC DEFAULT 45,
    camera_rotation_x NUMERIC DEFAULT -0.5,
    camera_rotation_y NUMERIC DEFAULT 0,
    camera_rotation_z NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Create annotations table for all annotation types
CREATE TABLE public.annotations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('player', 'arrow', 'zone', 'freehand', 'spotlight', 'text')),
    label TEXT,
    color TEXT DEFAULT '#00d4ff',
    position_x NUMERIC,
    position_y NUMERIC,
    position_z NUMERIC,
    end_position_x NUMERIC,
    end_position_y NUMERIC,
    end_position_z NUMERIC,
    points JSONB,
    radius NUMERIC,
    stroke_width NUMERIC DEFAULT 3,
    timestamp_start NUMERIC DEFAULT 0,
    timestamp_end NUMERIC,
    metadata JSONB DEFAULT '{}',
    layer_order INTEGER DEFAULT 0,
    visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calibrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = user_id);

-- Projects policies
CREATE POLICY "Users can view own projects" ON public.projects
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own projects" ON public.projects
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON public.projects
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON public.projects
    FOR DELETE USING (auth.uid() = user_id);

-- Calibrations policies
CREATE POLICY "Users can view calibrations for own projects" ON public.calibrations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can create calibrations for own projects" ON public.calibrations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can update calibrations for own projects" ON public.calibrations
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can delete calibrations for own projects" ON public.calibrations
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    );

-- Annotations policies
CREATE POLICY "Users can view annotations for own projects" ON public.annotations
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can create annotations for own projects" ON public.annotations
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can update annotations for own projects" ON public.annotations
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    );

CREATE POLICY "Users can delete annotations for own projects" ON public.annotations
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND user_id = auth.uid())
    );

-- Create function for automatic timestamp updates
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON public.projects
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calibrations_updated_at
    BEFORE UPDATE ON public.calibrations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_annotations_updated_at
    BEFORE UPDATE ON public.annotations
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, email)
    VALUES (NEW.id, NEW.email);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-creating profile
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();