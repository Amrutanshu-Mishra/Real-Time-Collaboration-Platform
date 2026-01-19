import { Button } from "@/components/ui/button";
import { Settings, Share2, Menu, Folder, Search, MoreHorizontal } from "lucide-react";
import Tiptap from "../../components/ui/text_editor";

// Placeholder Avatar component since we don't have one yet
function UserAvatar({ fallback, src, className }: { fallback: string, src?: string, className?: string }) {
     return (
          <div className={`relative inline-flex items-center justify-center size-8 rounded-full overflow-hidden bg-muted ${className}`}>
               <span className="font-medium text-xs text-muted-foreground">{fallback}</span>
          </div>
     )
}

export default function EditorPage() {
     return (
          <div className="flex h-screen w-full bg-background overflow-hidden">
               {/* Sidebar */}
               <aside className="w-64 border-r border-border/50 bg-muted/20 hidden md:flex flex-col">
                    <div className="p-4 border-b border-border/50 flex items-center gap-2">
                         <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <Folder className="size-4" />
                         </div>
                         <span className="font-semibold text-sm">My Projects</span>
                    </div>

                    <div className="p-2">
                         <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                              <Search className="mr-2 size-4" />
                              Search...
                         </Button>
                    </div>

                    <div className="flex-1 overflow-auto p-2 space-y-1">
                         <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground/70">FILES</div>
                         {[
                              "Project Requirements.md",
                              "Marketing Copy.md",
                              "Q1 Goals.md",
                              "Meeting Notes.md"
                         ].map((file, i) => (
                              <Button key={i} variant={i === 0 ? "secondary" : "ghost"} className="w-full justify-start h-8 text-sm font-normal">
                                   <span className="truncate">{file}</span>
                              </Button>
                         ))}
                    </div>

                    <div className="p-4 border-t border-border/50">
                         <Button variant="ghost" className="w-full justify-start text-muted-foreground">
                              <Settings className="mr-2 size-4" />
                              Settings
                         </Button>
                    </div>
               </aside>

               {/* Main Content */}
               <div className="flex-1 flex flex-col min-w-0">
                    {/* Header */}
                    <header className="h-14 border-b border-border/50 flex items-center justify-between px-4 bg-background/50 backdrop-blur-sm z-10">
                         <div className="flex items-center gap-4">
                              <Button variant="ghost" size="icon" className="md:hidden">
                                   <Menu className="size-5" />
                              </Button>
                              <div className="flex items-center gap-2">
                                   <h1 className="font-semibold text-sm">Project Requirements.md</h1>
                                   <span className="text-muted-foreground/30">/</span>
                                   <span className="text-xs text-muted-foreground">Last edited just now</span>
                              </div>
                         </div>

                         <div className="flex items-center gap-3">
                              <div className="flex -space-x-2">
                                   <UserAvatar fallback="AM" className="ring-2 ring-background z-30" />
                                   <UserAvatar fallback="JD" className="ring-2 ring-background z-20" />
                                   <UserAvatar fallback="SJ" className="ring-2 ring-background z-10" />
                              </div>
                              <div className="h-4 w-px bg-border mx-1" />
                              <Button variant="outline" size="sm" className="hidden sm:flex">
                                   <Share2 className="mr-2 size-3" />
                                   Share
                              </Button>
                              <Button variant="ghost" size="icon" className="sm:hidden">
                                   <MoreHorizontal className="size-4" />
                              </Button>
                         </div>
                    </header>

                    {/* Editor Area */}
                    <main className="flex-1 overflow-auto relative bg-muted/10">
                         <div className="absolute inset-0 bg-grid-black/[0.02] dark:bg-grid-white/[0.02] pointer-events-none" />
                         <Tiptap />
                    </main>
               </div>
          </div>
     );
};