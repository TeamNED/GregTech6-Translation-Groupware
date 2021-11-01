#include "DictGenerator.hpp"

DictGenerator::DictGenerator(shared_ptr<IGeneratorMeta> meta)
    : Generator(meta) {}
DictGenerator::DictGenerator(shared_ptr<IGeneratorMeta> meta,
                             LangListPointer dict)
    : Generator(meta), _dict(dict) {}

LangListPointer DictGenerator::dict() { return this->_dict; }

vector<shared_ptr<ILangResult>> DictGenerator::results() {
  if (_result == nullptr) {
    _result = std::make_shared<DictLangResult>(this->meta(), this->_dict);
  }
  return vector<shared_ptr<ILangResult>>{_result};
}