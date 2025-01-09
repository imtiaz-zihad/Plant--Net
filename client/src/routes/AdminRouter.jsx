import PropTypes from "prop-types"
import LoadingSpinner from "../components/Shared/LoadingSpinner"
import { Navigate} from "react-router-dom"

import useRole from "../hooks/useRole"


const AdminRouter = ({children}) => {
    const [role,isLoading] =useRole();
    
  
    if (isLoading) return <LoadingSpinner />
    if (role=== 'admin') return children
    return <Navigate to='/dashboard'  replace='true' />
  }
  
  AdminRouter.propTypes = {
    children: PropTypes.element,
  }


export default AdminRouter;