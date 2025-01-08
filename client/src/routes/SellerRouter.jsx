import PropTypes from "prop-types"
import LoadingSpinner from "../components/Shared/LoadingSpinner"
import { Navigate, useLocation } from "react-router-dom"
import useAuth from "../hooks/useAuth"


const SellerRouter = ({children}) => {
    
    const location = useLocation()
  
    if (loading) return <LoadingSpinner />
    if (user) return children
    return <Navigate to='/login' state={{ from: location }} replace='true' />
  }
  
  SellerRouter.propTypes = {
    children: PropTypes.element,
  }


export default SellerRouter;