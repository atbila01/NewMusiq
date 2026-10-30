import { SubscriptionPage } from '../../components/pages/SubscriptionPage';
import { useProfile } from '../lib/profile';
import { Link } from 'react-router-dom';
export default function Subscribe() { const {profile} = useProfile(); return <div className="nm-billing"><Link to="/">Back to NewMusiq</Link><SubscriptionPage complimentary={profile?.complimentary === true} /></div>; }
