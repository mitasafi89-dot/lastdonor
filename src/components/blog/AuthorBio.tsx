interface AuthorBioProps {
  name: string;
  bio: string | null;
}

export function AuthorBio({ name, bio }: AuthorBioProps) {
  return (
    <div className="flex items-start gap-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-lg font-bold text-primary">
        {name.charAt(0).toUpperCase()}
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{name}</p>
        {bio && (
          <p className="mt-1 text-sm text-muted-foreground">{bio}</p>
        )}
      </div>
    </div>
  );
}
