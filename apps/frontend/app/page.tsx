import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Globe, Lock, Zap } from "lucide-react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col min-h-[calc(100vh-4rem)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 lg:py-32 xl:py-40">
        <div className="container px-4 md:px-6 relative z-10">
          <div className="grid gap-6 lg:grid-cols-[1fr_500px] lg:gap-12 xl:grid-cols-[1fr_600px] items-center">
            <div className="flex flex-col justify-center space-y-8">
              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary backdrop-blur-sm">
                  <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                  Now in Public Beta
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl xl:text-7xl/none">
                  Collaborate in <span className="text-gradient">Real-Time</span> without limits.
                </h1>
                <p className="max-w-[600px] text-muted-foreground md:text-xl leading-relaxed">
                  Experience the future of teamwork with our ultra-low latency platform. Edit, chat, and build together as if you were in the same room.
                </p>
              </div>
              <div className="flex flex-col gap-3 min-[400px]:flex-row">
                <Button size="lg" variant="premium" className="h-12 px-8 text-base">
                  Start Collaborating <ArrowRight className="ml-2 size-4" />
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                  View Demo
                </Button>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="size-8 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[10px] font-bold">
                      U{i}
                    </div>
                  ))}
                </div>
                <p>Trusted by 1,000+ teams</p>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary to-purple-600 rounded-2xl blur-3xl opacity-20 animate-pulse"></div>
              <div className="relative rounded-2xl border bg-background/50 backdrop-blur-sm p-2 shadow-2xl">
                <div className="rounded-xl border bg-card p-4 aspect-video flex items-center justify-center text-muted-foreground">
                  {/* Placeholder for Hero Image/Dashboard Preview */}
                  <div className="text-center space-y-2">
                    <div className="size-16 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                      <Zap className="size-8 text-primary" />
                    </div>
                    <p className="font-medium">Interactive Dashboard Preview</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Background Elements */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl -z-10 pointer-events-none"></div>
      </section>

      {/* Features Section */}
      <section className="py-24 bg-muted/30">
        <div className="container px-4 md:px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to ship faster</h2>
            <p className="text-muted-foreground text-lg">
              Powerful features designed to keep your team in sync and productive, no matter where they are.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <Card className="bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="size-12 rounded-lg bg-blue-500/10 flex items-center justify-center mb-4 text-blue-500">
                  <Zap className="size-6" />
                </div>
                <CardTitle>Lightning Fast</CardTitle>
                <CardDescription>
                  Built on edge infrastructure for sub-30ms latency worldwide.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="size-12 rounded-lg bg-green-500/10 flex items-center justify-center mb-4 text-green-500">
                  <Lock className="size-6" />
                </div>
                <CardTitle>Enterprise Secure</CardTitle>
                <CardDescription>
                  End-to-end encryption and SOC2 compliance out of the box.
                </CardDescription>
              </CardHeader>
            </Card>
            <Card className="bg-background/50 backdrop-blur-sm border-primary/10 hover:border-primary/30 transition-colors">
              <CardHeader>
                <div className="size-12 rounded-lg bg-purple-500/10 flex items-center justify-center mb-4 text-purple-500">
                  <Globe className="size-6" />
                </div>
                <CardTitle>Global Scale</CardTitle>
                <CardDescription>
                  Collaborate with anyone, anywhere, with automatic region routing.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/50 bg-background">
        <div className="container px-4 md:px-6">
          <div className="grid gap-8 md:grid-cols-4">
            <div className="space-y-4">
              <div className="flex items-center gap-2 font-bold text-xl">
                <div className="size-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground">
                  <Zap className="size-5 fill-current" />
                </div>
                <span>SyncOrbit</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Empowering teams to build the future together.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Features</a></li>
                <li><a href="#" className="hover:text-foreground">Integrations</a></li>
                <li><a href="#" className="hover:text-foreground">Pricing</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Blog</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Privacy</a></li>
                <li><a href="#" className="hover:text-foreground">Terms</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
            © {new Date().getFullYear()} SyncOrbit Inc. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
