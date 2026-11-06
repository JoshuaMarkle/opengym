import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { useData } from '../../data/DataProvider';
import { ExerciseFormView } from './ExerciseFormView';

/** 8.3 as a page: /exercises/new and /exercises/:id/edit. */
export function ExerciseForm() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { exerciseMap } = useData();
  const exercise = id ? exerciseMap.get(id) : undefined;
  if (id && (!exercise || exercise.deletedAt)) return <Navigate to="/exercises" replace />;
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate(exercise ? `/exercises/${exercise.id}` : '/exercises'));
  return (
    <ExerciseFormView
      exercise={exercise}
      initialName={params.get('name') ?? ''}
      onCancel={back}
      onSaved={(sid) => (exercise ? back() : navigate(`/exercises/${sid}`, { replace: true }))}
    />
  );
}
