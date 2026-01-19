import Link from "next/link"
import { Button } from "./ui/button"
import { Zap } from "lucide-react"

export function Navbar() {
     return (
          <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
               <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 font-bold text-xl">
                         <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                              <Zap className="size-5 fill-current" />
                         </div>
                         <span>SyncOrbit</span>
                    </Link>
                    <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
                         <Link href="#" className="hover:text-foreground transition-colors">Features</Link>
                         <Link href="#" className="hover:text-foreground transition-colors">Pricing</Link>
                         <Link href="#" className="hover:text-foreground transition-colors">About</Link>
                         <Link href="#" className="hover:text-foreground transition-colors">Blog</Link>
                    </nav>
                    <div className="flex items-center gap-2">
                         <Button variant="ghost" size="sm">Sign In</Button>
                         <Button size="sm" variant="premium">Get Started</Button>
                    </div>
               </div>
          </header>
     )
}
