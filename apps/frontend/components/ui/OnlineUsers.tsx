'use client'

import type { UserInfo } from '@/hooks/usePresence'

function getInitials(name: string): string {
     return name
          .split('-')
          .map((part) => part[0]?.toUpperCase() ?? '')
          .join('')
          .slice(0, 2)
}

interface OnlineUsersProps {
     users: UserInfo[]
     currentUserId?: string | null
}

export default function OnlineUsers({ users, currentUserId }: OnlineUsersProps) {
     const MAX_VISIBLE = 4
     const visible = users.slice(0, MAX_VISIBLE)
     const overflow = users.length - MAX_VISIBLE

     return (
          <div className="flex items-center gap-2">
               <div className="flex -space-x-2">
                    {visible.map((user, i) => (
                         <div
                              key={user.userId}
                              className="online-avatar-wrapper"
                              style={{ zIndex: visible.length - i }}
                              title={user.userId === currentUserId ? `${user.name} (You)` : user.name}
                         >
                              <div
                                   className="online-avatar"
                                   style={{ backgroundColor: user.color }}
                              >
                                   <span className="online-avatar-text">
                                        {getInitials(user.name)}
                                   </span>
                              </div>
                              {/* Green online dot */}
                              <span className="online-dot" />
                              {/* "You" indicator */}
                              {user.userId === currentUserId && (
                                   <span className="online-you-badge">You</span>
                              )}
                         </div>
                    ))}

                    {overflow > 0 && (
                         <div
                              className="online-avatar-wrapper"
                              style={{ zIndex: 0 }}
                              title={`${overflow} more user${overflow > 1 ? 's' : ''}`}
                         >
                              <div className="online-avatar online-avatar-overflow">
                                   <span className="online-avatar-text">
                                        +{overflow}
                                   </span>
                              </div>
                         </div>
                    )}
               </div>

               <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    {users.length} online
               </span>
          </div>
     )
}
