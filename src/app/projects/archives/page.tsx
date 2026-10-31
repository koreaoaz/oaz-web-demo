'use client';

import React, { useState } from "react";
import { useAsyncQuery } from "@/hooks/useAsyncQuery";
// import { Project } from "./Project";
import ProjectGrid from "../../../components/projects/ProjectGrid";
// import ProjectFilters from "../components/projects/ProjectFilters";
import ProjectModal from "../../../components/projects/ProjectModal";
// import ProjectStats from "../components/projects/ProjectStats";
import { supabase } from '@/lib/supabaseClient';
// import { Input } from "@/components/ui/input";
import { Project, RawProjectRow } from "@/types/project";

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === "string");
}

function mapProjectRow(p: RawProjectRow): Project {
  let techStack: unknown = [];

  if (Array.isArray(p.tech_stack)) {
    techStack = p.tech_stack;
  } else if (typeof p.tech_stack === "string" && p.tech_stack) {
    try {
      const parsed: unknown = JSON.parse(p.tech_stack);
      if (Array.isArray(parsed)) {
        techStack = parsed;
      } else if (parsed !== null && typeof parsed === "object" && "stack" in parsed && Array.isArray(parsed.stack)) {
        techStack = parsed.stack;
      }
    } catch {
      console.error("tech_stack 파싱 실패: 빈 기술 스택으로 표시합니다.");
    }
  }

  const imagePath = p.image_url || p.filename;

  return {
    id: p.id,
    title: p.project_name ?? "",
    description: p.description || "",
    category: p.category || "기타",
    duration: p.duration || "",
    team_size: p.team_size || 0,
    members: p.members || "",
    year: p.year || undefined,
    semester: p.semester || undefined,
    detailed_description: p.detailed_description || "",
    created_at: p.created_at,
    // 비정상 배열은 이 프로젝트의 기술 스택만 비우고, 다른 필드는 유지한다.
    tech_stack: isStringArray(techStack) ? techStack : [],
    achievements: [], // 마찬가지로 achievements도 JSON이면 파싱 필요
    image_url: imagePath
      ? supabase.storage.from("project_img").getPublicUrl(imagePath).data.publicUrl
      : undefined,
    github_url: p.github_url || "",
  };
}

const EMPTY_PROJECTS: Project[] = [];

   const loadProjects = async () => {

    // 필요한 컬럼만 선택
    const { data, error } = await supabase
      .from("editor_1_projects")
      .select(`
        id,
        project_name,
        category,
        duration,
        team_size,
        members,
        description,
        created_at,
        year,
        semester,
        detailed_description,
        tech_stack,
        achievements,
        filename,
        image_url,
        github_url
      `)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error("프로젝트를 불러오지 못했습니다.");
    }

    let mapped: Project[];
    try {
      mapped = data?.map(mapProjectRow) ?? [];
    } catch {
      throw new Error("프로젝트 데이터 형식이 올바르지 않습니다.");
    }

    const latest = mapped.reduce<Project | null>((latest, p) => {
      if (!latest) return p;
      if ((p.year ?? 0) > (latest.year ?? 0)) return p;
      if ((p.year ?? 0) === (latest.year ?? 0) && (p.semester ?? 0) > (latest.semester ?? 0)) return p;
      return latest;
    }, null);

    const latestOnly = latest
      ? mapped.filter((p) => p.year === latest.year && p.semester === latest.semester)
      : mapped;

    return latestOnly;
  };

export default function Projects() {
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { data: Projects, loading: isLoading, error } = useAsyncQuery("projects", loadProjects, EMPTY_PROJECTS, "프로젝트를 불러오지 못했습니다. 다시 시도해 주세요.");

  // useEffect(() => {
  //   filterProjects();
  // }, [projects, selectedCategory, searchTerm]);

  // const loadProjects = async () => {
  //   try {
  //     const data = await Project.list("-created_date");
  //     setProjects(data);
  //   } catch (error) {
  //     console.error("프로젝트 로딩 실패:", error);
  //   } finally {
  //     setIsLoading(false);
  //   }
  // };

  // const filterProjects = () => {
  //   let filtered = projects;

  //   // 카테고리 필터
  //   if (selectedCategory !== "전체") {
  //     filtered = filtered.filter(project => project.category === selectedCategory);
  //   }

  //   // 검색 필터
  //   // if (searchTerm) {
  //   //   filtered = filtered.filter(project => 
  //   //     project.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //   //     project.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
  //   //     project.tech_stack?.some(tech => 
  //   //       tech.toLowerCase().includes(searchTerm.toLowerCase())
  //   //     )
  //   //   );
  //   // }

  //   setFilteredProjects(filtered);
  // };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              프로젝트 포트폴리오
            </h1>
            <p className="text-xl text-slate-600 max-w-3xl mx-auto leading-relaxed">
              AI부터 하드웨어까지, 다양한 영역에서 진행한 혁신적인 프로젝트들을 
              소개합니다. 각 프로젝트의 세부적인 내용은 성과 발표회를 통해 접할 수 있습니다.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Stats */}
        {/* <ProjectStats projects={projects} /> */}

        {/* Filters and Search */}
        {/* <div className="mb-12">
          <div className="flex flex-col lg:flex-row gap-6 items-start lg:items-center justify-between">
            <ProjectFilters 
              selectedCategory={selectedCategory}
              onCategoryChange={setSelectedCategory}
              projects={projects}
            />
            
            <div className="relative w-full lg:w-80">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="프로젝트나 기술 스택 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 border-slate-300 focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div> */}
        {/* </div> */}

        {/* Projects Grid */}
        {/* <ProjectGrid 
          projects={filteredProjects}
          isLoading={isLoading}
          onProjectClick={setSelectedProject}
        /> */}
        {error && <p role="alert" className="mb-4 text-red-600">{error}</p>}
        <ProjectGrid 
          Projects={Projects}
          isLoading={isLoading}
          onProjectClick={setSelectedProject}
        />

        {/* Results Info */}
        {/* {!isLoading && (
          <div className="mt-12 text-center">
            <p className="text-slate-600">
              {searchTerm || selectedCategory !== "전체" 
                ? `${filteredProjects.length}개의 프로젝트를 찾았습니다`
                : `총 ${projects.length}개의 프로젝트`
              }
            </p>
          </div>
        )} */}
      </div>

      {/* Project Detail Modal */}
      <ProjectModal 
        project={selectedProject}
        onClose={() => setSelectedProject(null)}
      />
    </div>
  );
};
