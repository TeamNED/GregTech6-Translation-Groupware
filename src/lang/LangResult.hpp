#ifndef LANGRESULT_H
#define LANGRESULT_H
#pragma once

#include <memory>
#include <string>
#include <vector>

#include "ILangResult.hpp"

class LangResult : public ILangResult {
private:
  shared_ptr<IGeneratorMeta> _meta;

public:
  LangResult() = default;
  LangResult(shared_ptr<IGeneratorMeta> meta);
  LangResult(const LangResult &) = default;
  LangResult(LangResult &&) = default;
  LangResult &operator=(const LangResult &) = default;
  LangResult &operator=(LangResult &&) = default;
  virtual ~LangResult() = default;
  virtual shared_ptr<IGeneratorMeta> meta() const override;
  virtual shared_ptr<IGeneratorMeta> &meta();
  virtual LangListPointer result() const override;
  virtual bool empty() const override;
};
#endif