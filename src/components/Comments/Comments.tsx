import { MessageSquare } from 'lucide-react'
import { DockablePanel } from '../shared/DockablePanel'
import { useCommentStore } from '../../store/commentStore'
import styles from './Comments.module.css'

function formatTime(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${m} ${ampm}`
}

export function Comments() {
  const comments = useCommentStore((s) => s.comments)

  return (
    <DockablePanel
      widgetId="comments"
      title="Comments"
      icon={<MessageSquare size={16} />}
    >
      <div className={styles.container}>
        {comments.length === 0 ? (
          <div className={styles.empty}>
            Tag a collaborator with @ to leave a comment
          </div>
        ) : (
          <div className={styles.list}>
            {comments.map((c) => (
              <div key={c.id} className={styles.comment}>
                <div className={styles.commentHeader}>
                  <span className={styles.commentAuthor}>{c.author}</span>
                  {c.taggedCollaboratorNames.length > 0 && (
                    <>
                      <span className={styles.commentArrow}>&rarr;</span>
                      <span className={styles.commentTagged}>
                        {c.taggedCollaboratorNames.map((n) => `@${n}`).join(', ')}
                      </span>
                    </>
                  )}
                  <span className={styles.commentTime}>{formatTime(c.timestamp)}</span>
                </div>
                <div className={styles.commentBody}>{c.text}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DockablePanel>
  )
}
