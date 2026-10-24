#include "ILangResult.hpp"

ILangResult::operator bool() const { return !(this->empty()); }