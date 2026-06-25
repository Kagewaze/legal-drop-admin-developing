import { useEffect, useRef, useState } from "react";
import { LuSearch } from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import customFetch from "../utils/customFetch";
import { useGlobalContext } from "../utils/context";

export const SearchEntity = ({
  setFormData,
  formData,
  routeTitle,
  placeholder,
  pageLayout = false,
  updateDataFunction,
}) => {
  const [searchResults, setSearchResults] = useState([]);
  const dropdownRef = useRef(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const { searchTerm, setSearchTerm } = useGlobalContext();

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target) &&
        (!dropdownRef.current || !dropdownRef.current.contains(event.target))
      ) {
        setIsSearchFocused(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [searchRef, dropdownRef]);

  // debounce search
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func.apply(null, args), delay);
    };
  };

  const debouncedSearch = debounce(async (value) => {
    const url = `admin/${routeTitle}?search=${value}`;
    try {
      const {
        data: { data },
        status,
      } = await customFetch(url);
      if (status === 200) {
        if (!pageLayout) {
          setSearchResults(data);
        } else {
          updateDataFunction(data);
        }
      }
    } catch (error) {
      console.error("Error fetching search results:", error);
    }
  }, 300);

  // Function to handle search input change
  async function handleSearchChange(event) {
    const { value } = event.target;
    setSearchTerm(value);
    debouncedSearch(value);
    setIsSearchFocused(true);
  }

  function handleResultClick(firstName, lastName, id) {
    if (setFormData) {
      setFormData({
        ...formData,
        driverId: id,
      });
    }
    setIsSearchFocused(false);
    setSearchTerm(`${firstName} ${lastName}`);
  }

  return (
    <div ref={searchRef} className={`flex mr-4 items-center relative  w-full`}>
      <LuSearch className="absolute left-2 text-gray-400" size={20} />
      <input
        type="text"
        placeholder={placeholder}
        value={searchTerm}
        onChange={handleSearchChange}
        className={`border-gray300 text-gray900 inline-block w-full border rounded-lg py-1  globalInputRingGreen placeholder:text-xs pl-8`}
      />

      {/* Display search results */}
      {isSearchFocused && searchResults && !pageLayout && (
        <ul className="absolute z-10 top-12 left-0 w-full bg-white border border-gray-200 px-2 rounded-lg shadow-lg p-2">
          {searchResults.length > 0 && (
            <ul className="space-y-2">
              {searchResults.map(
                ({ firstName, email, phoneNumber, id, lastName }, index) => (
                  <li
                    key={index}
                    onClick={() => handleResultClick(firstName, lastName, id)}
                    className="truncate px-2 text-sm cursor-pointer hover:text-primaryGreen  "
                  >
                    <button type="button" className="flex gap-x-4 ">
                      <span>{index + 1}.</span>
                      <div className=" flex gap-x-2">
                        <span>{firstName}</span>
                        <span>{email}</span>
                        <span>{phoneNumber}</span>
                      </div>
                    </button>
                  </li>
                )
              )}
            </ul>
          )}
        </ul>
      )}
    </div>
  );
};
