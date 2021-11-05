#include "DictLangResult.hpp"

DictLangResult::DictLangResult(shared_ptr<IGeneratorMeta> meta,
                               LangListPointer dict)
    : LangResult(std::move(meta)), _dict(std::move(dict)) {}

LangListPointer &DictLangResult::dict() { return this->_dict; }
const LangListPointer &DictLangResult::dict() const { return this->_dict; }
LangListPointer DictLangResult::result() const { return this->_dict; }
bool DictLangResult::empty() const {
  return this->meta() == nullptr || this->meta()->empty() ||
         this->_dict == nullptr || this->_dict->empty();
}