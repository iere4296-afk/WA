type RetryJob<T> = {
  payload: T
  retries: number
}

export class RetryQueue<T> {
  private jobs: RetryJob<T>[] = []

  constructor(private readonly maxRetries = 3) {}

  enqueue(payload: T) {
    this.jobs.push({ payload, retries: 0 })
  }

  drain(): RetryJob<T>[] {
    const pending = [...this.jobs]
    this.jobs = []
    return pending
  }

  requeue(job: RetryJob<T>) {
    if (job.retries >= this.maxRetries) {
      return false
    }

    this.jobs.push({ payload: job.payload, retries: job.retries + 1 })
    return true
  }
}
